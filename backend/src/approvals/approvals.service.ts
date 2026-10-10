import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ExecutionIntent } from '@prisma/client';
import { compareDecimals } from '../policies/rules';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ResolveApprovalDto } from './dto/resolve-approval.dto';

type ReviewIntent = Pick<ExecutionIntent, 'id' | 'organizationId' | 'environment' | 'type' | 'chain' | 'sellAsset' | 'buyAsset' | 'amount' | 'constraints'>;

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService, private readonly tenancy: TenancyService, private readonly webhooks: WebhooksService) {}

  async requestForReview(intent: ReviewIntent, reason: string) {
    const existing = await this.prisma.approval.findFirst({
      where: { intentId: intent.id, status: 'pending' },
    });
    if (existing) return existing;
    const proposal = { type: intent.type, chain: intent.chain, sellAsset: intent.sellAsset, buyAsset: intent.buyAsset, amount: intent.amount, constraints: intent.constraints };
    return this.prisma.$transaction(async (tx) => {
      const approval = await tx.approval.create({
        data: { organizationId: intent.organizationId, environment: intent.environment, intentId: intent.id, reason, originalProposal: proposal as Prisma.InputJsonValue },
      });
      const event = { type: 'approval.requested', organizationId: intent.organizationId, environment: intent.environment, intentId: intent.id, payload: { approvalId: approval.id, reason } };
      await tx.event.create({ data: event });
      await tx.outboxEvent.create({ data: event });
      return approval;
    });
  }

  async list(organizationId: string, environment: string) {
    return this.prisma.approval.findMany({
      where: { organizationId, environment },
      include: { intent: { include: { decision: true, plan: true, quoteSet: { include: { quotes: true } } } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
  }

  async resolve(organizationId: string, environment: string, userId: string, id: string, dto: ResolveApprovalDto) {
    await this.tenancy.requireOperator(userId, organizationId);
    const approval = await this.prisma.approval.findFirst({
      where: { id, organizationId, environment },
      include: { intent: { include: { quoteSet: { include: { quotes: true } } } } },
    });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.status !== 'pending') throw new BadRequestException('Approval has already been resolved');
    if (dto.action === 'replace') this.validateReplacement(approval.intent, dto);
    if ((dto.action === 'replace' || dto.action === 'reject') && !dto.reason?.trim()) {
      throw new BadRequestException(`${dto.action === 'replace' ? 'Replacement' : 'Rejection'} reason is required`);
    }
    const status = dto.action === 'approve' ? 'approved' : dto.action === 'reject' ? 'rejected' : 'replaced';
    const resolved = await this.prisma.$transaction(async (tx) => {
      const resolved = await tx.approval.update({
        where: { id: approval.id },
        data: { status, resolutionReason: dto.reason?.trim() ?? null, replacementProposal: dto.action === 'replace' ? dto.replacement as Prisma.InputJsonValue : Prisma.JsonNull, resolvedBy: userId, resolvedAt: new Date() },
        include: { intent: true },
      });
      if (status === 'approved') await tx.executionIntent.update({ where: { id: approval.intentId }, data: { status: 'approved' } });
      if (status === 'rejected') await tx.executionIntent.update({ where: { id: approval.intentId }, data: { status: 'rejected' } });
      const event = { type: 'approval.resolved', organizationId, environment, intentId: approval.intentId, payload: { approvalId: approval.id, status, reason: dto.reason?.trim() ?? null } };
      await tx.event.create({ data: event });
      await tx.outboxEvent.create({ data: event });
      return resolved;
    });
    void this.webhooks.emit(organizationId, environment, 'approval.resolved', {
      approvalId: resolved.id,
      intentId: approval.intentId,
      status,
      reason: dto.reason?.trim() ?? null,
    });
    return resolved;
  }

  private validateReplacement(intent: { amount: string; constraints: Prisma.JsonValue; quoteSet: { quotes: Array<{ venue: string; expiresAt: Date }> } | null }, dto: ResolveApprovalDto) {
    const replacement = dto.replacement;
    if (!replacement || Object.keys(replacement).length === 0) throw new BadRequestException('Replacement details are required');
    if (replacement.amount !== undefined) {
      if (!/^\d+(\.\d+)?$/.test(replacement.amount) || compareDecimals(replacement.amount, '0') <= 0) throw new BadRequestException('Replacement amount must be a positive decimal string');
      if (compareDecimals(replacement.amount, intent.amount) > 0) throw new BadRequestException('Replacement amount cannot exceed the original amount');
    }
    if (replacement.venue !== undefined) {
      const constraints = (intent.constraints ?? {}) as { approved_venues?: string[] };
      if (constraints.approved_venues && !constraints.approved_venues.includes(replacement.venue)) throw new BadRequestException('Replacement venue is not allowed by the active constraints');
      const quote = intent.quoteSet?.quotes.find((item) => item.venue === replacement.venue);
      if (!quote || quote.expiresAt.getTime() <= Date.now()) throw new BadRequestException('Replacement venue has no fresh quote; requote before replacing');
    }
  }
}
