import { WebSocketGateway, WebSocketServer, OnGatewayInit } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';

/** Live lifecycle stream: intent → decision → route → execution → settlement. */
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true } })
export class EventsGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(EventsGateway.name);

  afterInit() {
    this.logger.log('WebSocket gateway ready (live intents stream)');
  }

  emitIntent(intent: unknown) {
    this.server?.emit('intent.created', intent);
  }

  emitDecision(decision: unknown) {
    this.server?.emit('decision.created', decision);
  }

  emitExecution(execution: unknown) {
    this.server?.emit('execution.updated', execution);
  }
}
