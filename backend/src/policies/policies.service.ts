import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_POLICY_NAME, DEFAULT_RULES, PolicyRules, effectiveConstraints, nextVersionNumber, validateRules } from './rules';

const SAMPLE_POLICIES: Array<{ name: string; rules: PolicyRules }> = [
  { name: 'Sample — Agent payments', rules: { maximum_amount: '1000', custom_rules: [{ name: 'Unapproved recipient', field: 'recipient.allowlisted', operator: 'not_equals', value: true, outcome: 'BLOCK', reason: 'Payments require an allowlisted recipient.' }, { name: 'High payment risk', field: 'metadata.riskScore', operator: 'greater_than', value: 70, outcome: 'REVIEW', reason: 'High-risk payments require human approval.' }] } },
  { name: 'Sample — Treasury rebalance', rules: { maximum_amount: '25000', maximum_slippage_bps: 50, custom_rules: [{ name: 'Rebalance only', field: 'metadata.action', operator: 'not_equals', value: 'rebalance', outcome: 'BLOCK', reason: 'This policy is reserved for treasury rebalancing.' }] } },
  { name: 'Sample — Asset swaps', rules: { maximum_amount: '5000', maximum_slippage_bps: 75, maximum_fee_bps: 100, custom_rules: [{ name: 'Swap only', field: 'metadata.action', operator: 'not_equals', value: 'swap', outcome: 'BLOCK', reason: 'This policy is reserved for asset swaps.' }] } },
  { name: 'Sample — Agent transfers', rules: { maximum_amount: '2000', custom_rules: [{ name: 'Transfer only', field: 'metadata.action', operator: 'not_equals', value: 'transfer', outcome: 'BLOCK', reason: 'This policy is reserved for transfers.' }] } },
  { name: 'Sample — Controlled withdrawals', rules: { maximum_amount: '500', custom_rules: [{ name: 'Withdrawal only', field: 'metadata.action', operator: 'not_equals', value: 'withdraw', outcome: 'BLOCK', reason: 'This policy is reserved for withdrawals.' }, { name: 'Withdrawal review', field: 'actor.tier', operator: 'not_equals', value: 'premium', outcome: 'REVIEW', reason: 'Withdrawals by non-premium agents require approval.' }] } },
];

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, environment: string) {
    await this.ensureSamplePolicies(organizationId, environment);
    return this.prisma.policy.findMany({
      where: { organizationId, environment },
      include: { versions: { orderBy: { version: 'desc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** New workspaces start with editable, unpublished examples. They never affect live decisions until an operator publishes one. */
  private async ensureSamplePolicies(organizationId: string, environment: string) {
    await Promise.all(SAMPLE_POLICIES.map(({ name, rules }) => this.prisma.policy.upsert({
      where: { organizationId_environment_name: { organizationId, environment, name } },
      create: { organizationId, environment, name, versions: { create: { version: 1, status: 'draft', rules: rules as unknown as Prisma.InputJsonValue } } },
      update: {},
    })));
  }

  async create(organizationId: string, environment: string, name: string) {
    try {
      return await this.prisma.policy.create({ data: { organizationId, environment, name } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A policy with this name already exists');
      }
      throw error;
    }
  }

  async get(organizationId: string, environment: string, policyId: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    if (policy.organizationId !== organizationId || policy.environment !== environment) {
      throw new ForbiddenException('Policy belongs to another organization or environment');
    }
    return policy;
  }

  /** Delete only unused policy books; decision evidence must remain immutable. */
  async remove(organizationId: string, environment: string, policyId: string) {
    const policy = await this.get(organizationId, environment, policyId);
    const decisionCount = await this.prisma.decision.count({ where: { policyVersion: { policyId: policy.id } } });
    if (decisionCount > 0) throw new ConflictException('This policy is referenced by decision evidence and cannot be deleted. Keep it for audit history.');
    await this.prisma.policy.delete({ where: { id: policy.id } });
    return { id: policy.id, deleted: true };
  }

  /** New immutable draft version. Published versions can never be edited. */
  async createVersion(organizationId: string, environment: string, policyId: string, rules: unknown) {
    const policy = await this.get(organizationId, environment, policyId);
    validateRules(rules);
    const version = nextVersionNumber(policy.versions.map((v) => v.version));
    return this.prisma.policyVersion.create({
      data: { policyId: policy.id, version, status: 'draft', rules: rules as Prisma.InputJsonValue },
    });
  }

  /** Draft → published. One-way; published versions are immutable. */
  async publish(organizationId: string, environment: string, policyId: string, version: number) {
    const policy = await this.get(organizationId, environment, policyId);
    const target = policy.versions.find((v) => v.version === version);
    if (!target) throw new NotFoundException('Policy version not found');
    if (target.status === 'published') return target;
    return this.prisma.policyVersion.update({
      where: { id: target.id },
      data: { status: 'published', publishedAt: new Date() },
    });
  }

  /** Latest published version of a policy (null when nothing published yet). */
  async activeVersion(organizationId: string, environment: string, policyId: string) {
    const policy = await this.get(organizationId, environment, policyId);
    return policy.versions.filter((v) => v.status === 'published').sort((a, b) => b.version - a.version)[0] ?? null;
  }

  async publishedRules(organizationId: string, environment: string, policyVersionId: string): Promise<{ policyVersionId: string; rules: PolicyRules }> {
    const version = await this.prisma.policyVersion.findFirst({
      where: { id: policyVersionId, status: 'published', policy: { organizationId, environment } },
    });
    if (!version) throw new NotFoundException('Published policy version not found for this organization and environment');
    return { policyVersionId: version.id, rules: { ...DEFAULT_RULES, ...((version.rules ?? {}) as PolicyRules) } };
  }

  /**
   * Rules + version id the intent pipeline evaluates under. Ensures the
   * default policy exists (preserving Phase 2 behavior for existing orgs).
   */
  async activeRules(organizationId: string, environment: string): Promise<{ policyVersionId: string; rules: PolicyRules }> {
    // A published operator policy must actually become active. Looking up only
    // the built-in policy made successful publishes inert in the intent path.
    const active = await this.prisma.policyVersion.findFirst({
      where: { status: 'published', policy: { organizationId, environment } },
      orderBy: { publishedAt: 'desc' },
      include: { policy: { select: { name: true } } },
    });
    if (active) {
      const rules = { ...DEFAULT_RULES, ...((active.rules ?? {}) as PolicyRules) };
      // Existing workspaces may have seeded the built-in policy before Tempo
      // payments became a registered demo venue. Keep operator-authored
      // policies immutable, but make the legacy built-in default forward
      // compatible with the current registered venue set.
      if (active.policy.name === DEFAULT_POLICY_NAME) {
        return {
          policyVersionId: active.id,
          rules: {
            ...rules,
            approved_venues: [...new Set([...(rules.approved_venues ?? DEFAULT_RULES.approved_venues), 'tempo-payments'])],
          },
        };
      }
      return { policyVersionId: active.id, rules };
    }

    let policy = await this.prisma.policy.findUnique({
      where: { organizationId_environment_name: { organizationId, environment, name: DEFAULT_POLICY_NAME } },
      include: { versions: true },
    });
    if (!policy) {
      policy = await this.prisma.policy.create({
        data: { organizationId, environment, name: DEFAULT_POLICY_NAME },
        include: { versions: true },
      });
    }
    const seeded = await this.prisma.policyVersion.create({
      data: {
        policyId: policy.id,
        version: nextVersionNumber(policy.versions.map((v) => v.version)),
        status: 'published',
        rules: DEFAULT_RULES as unknown as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
    });
    return { policyVersionId: seeded.id, rules: { ...DEFAULT_RULES } };
  }

  resolveEffective(policyRules: PolicyRules, intentConstraints: PolicyRules): PolicyRules {
    return effectiveConstraints(policyRules, intentConstraints);
  }
}
