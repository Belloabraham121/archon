import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ChainAdapter } from '../chains/adapters/chain-adapter.interface';
import { ChainsService } from '../chains/chains.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';

@Injectable()
export class ConnectorsService {
  constructor(private readonly chains: ChainsService, private readonly prisma: PrismaService, private readonly tenancy: TenancyService, private readonly audit: AuditService) {}

  private adapterRows() { return this.chains.supportedChains().flatMap((chain) => this.chains.forChain(chain).map((adapter) => ({ chain, venue: (adapter as { venue?: string }).venue ?? chain, adapter }))); }
  async list(organizationId: string, environment: string) {
    const settings = await this.prisma.connectorSetting.findMany({ where: { organizationId, environment } });
    const configured = new Map(settings.map((setting) => [`${setting.chain}:${setting.venue}`, setting]));
    return Promise.all(this.adapterRows().map(async ({ chain, venue, adapter }) => {
      const started = performance.now(); let healthy = true;
      try { await adapter.getBalances('connector-health', []); } catch { healthy = false; }
      const setting = configured.get(`${chain}:${venue}`);
      return { chain, venue, enabled: setting?.enabled ?? true, health: healthy ? 'healthy' : 'degraded', latencyMs: Math.max(0, Math.round(performance.now() - started)), updatedAt: setting?.updatedAt ?? null };
    }));
  }
  async enabledForChain(organizationId: string, environment: string, chain: string): Promise<ChainAdapter[]> {
    const adapters = this.chains.forChain(chain);
    const settings = await this.prisma.connectorSetting.findMany({ where: { organizationId, environment, chain } });
    const disabled = new Set(settings.filter((setting) => !setting.enabled).map((setting) => setting.venue));
    return adapters.filter((adapter) => !disabled.has((adapter as { venue?: string }).venue ?? chain));
  }
  async update(organizationId: string, environment: string, userId: string, chain: string, venue: string, enabled: boolean) {
    await this.tenancy.requireOperator(userId, organizationId);
    const registered = this.adapterRows().some((item) => item.chain === chain && item.venue === venue);
    if (!registered) throw new NotFoundException('Connector not found');
    const before = await this.prisma.connectorSetting.findUnique({ where: { organizationId_environment_chain_venue: { organizationId, environment, chain, venue } } });
    const saved = await this.prisma.connectorSetting.upsert({ where: { organizationId_environment_chain_venue: { organizationId, environment, chain, venue } }, create: { organizationId, environment, chain, venue, enabled, changedBy: userId }, update: { enabled, changedBy: userId } });
    await this.audit.record({ organizationId, environment, action: 'connector.updated', actorId: userId, resource: `${chain}/${venue}`, before: before ? { enabled: before.enabled } : null, after: { enabled: saved.enabled } });
    return saved;
  }
  async requireEnabled(organizationId: string, environment: string, chain: string, venue: string) {
    const adapters = await this.enabledForChain(organizationId, environment, chain);
    if (!adapters.some((adapter) => (adapter as { venue?: string }).venue === venue)) throw new BadRequestException('Connector is disabled for this environment');
  }
}
