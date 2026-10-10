import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ChainsService } from '../chains/chains.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ExecuteIntentDto } from './dto/execute-intent.dto';

export type ObservedExecutionStatus = 'pending' | 'confirmed' | 'failed' | 'reorged';

export function transitionExecutionStatus(status: ObservedExecutionStatus) {
  if (status === 'reorged') return { status: 'pending', reorgedAt: new Date(), confirmedAt: null, failureReason: 'Chain reorganization observed; awaiting fresh finality' };
  if (status === 'confirmed') return { status, confirmedAt: new Date(), failureReason: null };
  if (status === 'failed') return { status, failureReason: 'Transaction reverted or failed on chain' };
  return { status: 'pending' };
}

@Injectable()
export class ExecutionService {
  constructor(private readonly prisma: PrismaService, private readonly chains: ChainsService, private readonly tenancy: TenancyService, private readonly webhooks: WebhooksService) {}

  async execute(organizationId: string, environment: string, userId: string, intentId: string, dto: ExecuteIntentDto) {
    const kill = await this.killSwitch(organizationId, environment);
    if (kill.enabled) throw new ForbiddenException(`Execution is halted by the kill switch${kill.reason ? `: ${kill.reason}` : ''}`);
    if (!dto.authorization.trim()) throw new BadRequestException('Explicit signed authorization is required before submission');
    const intent = await this.prisma.executionIntent.findFirst({ where: { id: intentId, organizationId, environment }, include: { decision: true, plan: true, approvals: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (!intent) throw new NotFoundException('Intent not found');
    if (intent.chain === 'demo' && environment !== 'test') throw new ForbiddenException('The deterministic demo adapter is only available in the test environment');
    if (!intent.plan?.simOk) throw new BadRequestException('A successful simulation is required before execution');
    const approval = intent.approvals[0];
    const allowed = intent.decision?.outcome === 'DIRECT' || approval?.status === 'approved';
    if (!allowed) throw new ForbiddenException('This intent requires an approved authorization before execution');
    if (this.planExpired(intent.plan.plan)) throw new BadRequestException('Execution plan quote expired — requote and simulate again');
    const authorizationHash = createHash('sha256').update(dto.authorization).digest('hex');
    const adapter = this.chains.get(intent.plan.chain, intent.plan.venue);
    const attempt = await this.prisma.executionAttempt.create({ data: { organizationId, environment, intentId: intent.id, planId: intent.plan.id, venue: intent.plan.venue, chain: intent.plan.chain, signer: dto.signer ?? userId, authorizationHash, expectedOut: intent.plan.expectedOut } });
    try {
      const submitted = await adapter.submitAuthorizedTransaction(intent.chain === 'demo' ? { authorization: dto.authorization, signer: dto.signer ?? userId } : { rawTransaction: dto.authorization });
      const observed = this.toObservedStatus(await adapter.getExecutionStatus(submitted.hash));
      const execution = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.executionAttempt.update({ where: { id: attempt.id }, data: { transactionHash: submitted.hash, submittedAt: new Date(), ...transitionExecutionStatus(observed) } });
        const submittedEvent = { type: 'execution.submitted', organizationId, environment, intentId: intent.id, payload: { executionId: updated.id, transactionHash: submitted.hash, venue: updated.venue } };
        await tx.event.create({ data: submittedEvent }); await tx.outboxEvent.create({ data: submittedEvent });
        if (updated.status === 'confirmed') { const confirmed = { type: 'execution.confirmed', organizationId, environment, intentId: intent.id, payload: { executionId: updated.id, transactionHash: submitted.hash } }; await tx.event.create({ data: confirmed }); await tx.outboxEvent.create({ data: confirmed }); }
        await tx.executionIntent.update({ where: { id: intent.id }, data: { status: updated.status === 'confirmed' ? 'completed' : 'executing' } });
        return updated;
      });
      void this.webhooks.emit(organizationId, environment, 'execution.submitted', { executionId: execution.id, intentId: intent.id, transactionHash: execution.transactionHash, status: execution.status });
      if (execution.status === 'confirmed') void this.webhooks.emit(organizationId, environment, 'execution.confirmed', { executionId: execution.id, intentId: intent.id, transactionHash: execution.transactionHash, status: execution.status });
      return execution;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction submission failed';
      const failed = await this.prisma.executionAttempt.update({ where: { id: attempt.id }, data: { status: 'failed', failureReason: message.slice(0, 500) } });
      await this.recordEvent('execution.failed', organizationId, environment, intent.id, { executionId: failed.id, reason: failed.failureReason });
      void this.webhooks.emit(organizationId, environment, 'execution.failed', { executionId: failed.id, intentId: intent.id, status: failed.status });
      throw new BadRequestException(`Authorized submission failed: ${message}`);
    }
  }

  async get(organizationId: string, environment: string, id: string) { const execution = await this.prisma.executionAttempt.findFirst({ where: { id, organizationId, environment }, include: { intent: { include: { decision: true, plan: true } } } }); if (!execution) throw new NotFoundException('Execution not found'); return execution; }
  async list(organizationId: string, environment: string) { return this.prisma.executionAttempt.findMany({ where: { organizationId, environment }, include: { intent: { include: { decision: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }); }

  async refresh(organizationId: string, environment: string, id: string) {
    const execution = await this.get(organizationId, environment, id);
    if (!execution.transactionHash) return execution;
    const adapter = this.chains.get(execution.chain, execution.venue);
    const observed = this.toObservedStatus(await adapter.getExecutionStatus(execution.transactionHash));
    // A receipt that disappears after a recorded confirmation is evidence of a
    // reorganization, even though an RPC reports the current observation as pending.
    const transition = execution.status === 'confirmed' && observed === 'pending' ? 'reorged' : observed;
    const updated = await this.prisma.executionAttempt.update({ where: { id }, data: transitionExecutionStatus(transition) });
    if (transition === 'reorged') await this.recordEvent('execution.reorged', organizationId, environment, execution.intentId, { executionId: id, transactionHash: execution.transactionHash });
    return updated;
  }

  async setKillSwitch(organizationId: string, environment: string, userId: string, enabled: boolean, reason?: string) {
    await this.tenancy.requireOperator(userId, organizationId);
    if (enabled && !reason?.trim()) throw new BadRequestException('A kill switch reason is required when enabling it');
    return this.prisma.killSwitch.upsert({ where: { organizationId_environment: { organizationId, environment } }, create: { organizationId, environment, enabled, reason: reason?.trim() ?? null, changedBy: userId }, update: { enabled, reason: reason?.trim() ?? null, changedBy: userId } });
  }

  async killSwitch(organizationId: string, environment: string) { return (await this.prisma.killSwitch.findUnique({ where: { organizationId_environment: { organizationId, environment } } })) ?? { enabled: false, reason: null }; }

  private toObservedStatus(status: string): ObservedExecutionStatus { return ['confirmed', 'failed', 'reorged'].includes(status) ? status as ObservedExecutionStatus : 'pending'; }
  private planExpired(plan: unknown) { const expiry = (plan as { quoteExpiresAt?: unknown } | null)?.quoteExpiresAt; return typeof expiry === 'string' && new Date(expiry).getTime() <= Date.now(); }
  private async recordEvent(type: string, organizationId: string, environment: string, intentId: string, payload: object) { await this.prisma.$transaction(async (tx) => { await tx.event.create({ data: { type, organizationId, environment, intentId, payload } }); await tx.outboxEvent.create({ data: { type, organizationId, environment, intentId, payload } }); }); }
}
