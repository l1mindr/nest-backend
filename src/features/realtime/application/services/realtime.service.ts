import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Server } from 'socket.io';
import { sessionRoom, userRoom } from '../../realtime.constants';
import { RealtimeEvent } from '../../types/realtime-events';
import { IRealtimeEventPublisher } from '../interfaces/realtime.interface';

/**
 * Holds the Socket.IO server instance handed over by `RealtimeGateway.afterInit`
 * and exposes it to domain use-cases through `IRealtimeEventPublisher`, so
 * those use-cases never depend on the gateway or on `socket.io` directly.
 *
 * Single NestJS instance today (see Phase 4 audit): rooms are served entirely
 * from local server memory. If the backend is ever scaled to multiple
 * instances, this is the seam where a Socket.IO Redis adapter would attach —
 * nothing else in this module would need to change.
 */
@Injectable()
export class RealtimeService implements IRealtimeEventPublisher {
  private server?: Server;

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(RealtimeService.name);
  }

  attachServer(server: Server): void {
    this.server = server;
  }

  publishToUser(userId: string, event: RealtimeEvent): void {
    if (!this.server) return;

    this.server.to(userRoom(userId)).emit(event.type, event.payload);

    this.logger.info(
      { event: LogEvent.REALTIME_EVENT_PUBLISHED, type: event.type, userId },
      'Realtime event published'
    );
  }

  disconnectSession(sessionId: string): void {
    if (!this.server) return;

    this.server.in(sessionRoom(sessionId)).disconnectSockets(true);
  }

  disconnectUser(userId: string): void {
    if (!this.server) return;

    this.server.in(userRoom(userId)).disconnectSockets(true);
  }

  disconnectUserExcept(userId: string, exceptSessionId: string): void {
    if (!this.server) return;

    this.server
      .in(userRoom(userId))
      .except(sessionRoom(exceptSessionId))
      .disconnectSockets(true);
  }
}
