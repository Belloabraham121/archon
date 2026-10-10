import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenancyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Organizations the user belongs to (for the org switcher). */
  async organizationsForUser(userId: string) {
    const memberships = await this.prisma.member.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    }));
  }

  async isMember(userId: string, organizationId: string): Promise<boolean> {
    const member = await this.prisma.member.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    return member !== null;
  }

  async requireOperator(userId: string, organizationId: string) {
    const member = await this.prisma.member.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new ForbiddenException('Owner or admin role required for this operation');
    }
    return member;
  }

  async switchOrganization(userId: string, organizationId: string) {
    const membership = await this.prisma.member.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { organization: true },
    });
    if (!membership) throw new ForbiddenException('Not a member of this organization');
    return {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
    };
  }

  async settings(organizationId: string, environment: string) {
    return (await this.prisma.organizationSetting.findUnique({ where: { organizationId_environment: { organizationId, environment } } })) ?? { organizationId, environment, decisionRetentionDays: 365, judgmentFallback: 'review' };
  }

  async updateSettings(userId: string, organizationId: string, environment: string, input: { decisionRetentionDays?: number; judgmentFallback?: 'review' | 'deterministic' }) {
    await this.requireOperator(userId, organizationId);
    return this.prisma.organizationSetting.upsert({ where: { organizationId_environment: { organizationId, environment } }, create: { organizationId, environment, decisionRetentionDays: input.decisionRetentionDays ?? 365, judgmentFallback: input.judgmentFallback ?? 'review', updatedBy: userId }, update: { ...input, updatedBy: userId } });
  }
}
