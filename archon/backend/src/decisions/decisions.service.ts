import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DecisionsService {
  constructor(private readonly prisma: PrismaService) {}
  list(organizationId: string, environment: string) { return this.prisma.decision.findMany({ where: { organizationId, environment }, include: { intent: { include: { quoteSet: { include: { quotes: true } }, context: true, plan: true } }, policyVersion: true }, orderBy: { createdAt: 'desc' }, take: 100 }); }
  async get(organizationId: string, environment: string, id: string) { const decision = await this.prisma.decision.findFirst({ where: { id, organizationId, environment }, include: { intent: { include: { quoteSet: { include: { quotes: true } }, context: true, plan: true, executions: true, approvals: true } }, policyVersion: true } }); if (!decision) throw new NotFoundException('Decision not found'); return decision; }
}
