import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayInit } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth';
import { TenancyService } from '../tenancy/tenancy.service';

/** Live lifecycle stream: intent → decision → route → execution → settlement. */
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true } })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly tenancy: TenancyService) {}

  afterInit() {
    this.logger.log('WebSocket gateway ready (live intents stream)');
  }

  async handleConnection(client: Socket) {
    const organizationId = client.handshake.auth?.organizationId;
    if (typeof organizationId !== 'string') return client.disconnect(true);
    const session = await auth.api.getSession({ headers: fromNodeHeaders(client.handshake.headers) });
    if (!session || !(await this.tenancy.isMember(session.user.id, organizationId))) {
      return client.disconnect(true);
    }
    await client.join(this.organizationRoom(organizationId));
  }

  emitIntent(intent: { organizationId?: string }) {
    if (intent.organizationId) this.server?.to(this.organizationRoom(intent.organizationId)).emit('intent.created', intent);
  }

  emitDecision(decision: { organizationId?: string } | null) {
    if (decision?.organizationId) this.server?.to(this.organizationRoom(decision.organizationId)).emit('decision.created', decision);
  }

  emitExecution(execution: { organizationId?: string }) {
    if (execution.organizationId) this.server?.to(this.organizationRoom(execution.organizationId)).emit('execution.updated', execution);
  }

  private organizationRoom(organizationId: string) {
    return `organization:${organizationId}`;
  }
}
