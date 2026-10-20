import { createHmac } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService, private readonly tenancy: TenancyService, private readonly config: ConfigService) {}

  async list(organizationId: string, environment: string) { return this.prisma.webhookEndpoint.findMany({ where: { organizationId, environment }, include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 10 } }, orderBy: { createdAt: 'desc' } }); }
  async deliveries(organizationId: string, environment: string) { return this.prisma.webhookDelivery.findMany({ where: { endpoint: { organizationId, environment } }, include: { endpoint: true }, orderBy: { createdAt: 'desc' }, take: 100 }); }

  async create(organizationId: string, environment: string, userId: string, dto: CreateWebhookDto) {
    await this.tenancy.requireOperator(userId, organizationId);
    return this.prisma.webhookEndpoint.create({ data: { organizationId, environment, url: dto.url, events: [...new Set(dto.events)], enabled: dto.enabled ?? true } });
  }

  async remove(organizationId: string, environment: string, userId: string, id: string) {
    await this.tenancy.requireOperator(userId, organizationId);
    const endpoint = await this.prisma.webhookEndpoint.findFirst({ where: { id, organizationId, environment } });
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
    await this.prisma.webhookEndpoint.delete({ where: { id } });
    return { id, deleted: true };
  }

  async emit(organizationId: string, environment: string, eventType: string, payload: object) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({ where: { organizationId, environment, enabled: true, events: { has: eventType } } });
    return Promise.all(endpoints.map((endpoint) => this.deliver(endpoint.id, eventType, payload)));
  }

  async retry(organizationId: string, environment: string, userId: string, id: string) {
    await this.tenancy.requireOperator(userId, organizationId);
    const delivery = await this.prisma.webhookDelivery.findFirst({ where: { id, endpoint: { organizationId, environment } } });
    if (!delivery) throw new NotFoundException('Webhook delivery not found');
    return this.deliver(delivery.endpointId, delivery.eventType, delivery.payload as object);
  }

  private async deliver(endpointId: string, eventType: string, payload: object) {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({ where: { id: endpointId } });
    if (!endpoint || !endpoint.enabled) throw new BadRequestException('Webhook endpoint is disabled');
    const delivery = await this.prisma.webhookDelivery.create({ data: { endpointId, eventType, payload, status: 'pending', attempts: 1 } });
    const secret = this.config.get<string>('WEBHOOK_SIGNING_SECRET')?.trim();
    if (!secret) return this.prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { status: 'skipped', error: 'Webhook signing is not configured' } });
    const body = JSON.stringify({ id: delivery.id, type: eventType, data: payload });
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    try {
      const response = await fetch(endpoint.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Archon-Signature': `sha256=${signature}`, 'X-Archon-Event': eventType }, body, signal: AbortSignal.timeout(5_000) });
      return this.prisma.webhookDelivery.update({ where: { id: delivery.id }, data: response.ok ? { status: 'delivered', responseCode: response.status, deliveredAt: new Date() } : { status: 'failed', responseCode: response.status, error: `Endpoint returned HTTP ${response.status}` } });
    } catch (error) {
      return this.prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { status: 'failed', error: error instanceof Error ? error.message.slice(0, 500) : 'Webhook delivery failed' } });
    }
  }
}
