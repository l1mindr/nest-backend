import { LogEvent } from '@infrastructure/logging/logging.constants';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '@infrastructure/logging/mongodb/mongodb.constants';
import { AuditLogService } from '@infrastructure/logging/audit/audit-log.service';
import {
  IRealtimeEventPublisher,
  REALTIME_EVENT_PUBLISHER
} from '@features/realtime/application/interfaces/realtime.interface';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { EntityManager } from 'typeorm';
import {
  ISessionRepository,
  ISessionRevocationUseCase,
  SESSION_REPOSITORY
} from '../interfaces/sessions.interface';

@Injectable()
export class SessionRevocationUseCase implements ISessionRevocationUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    private readonly logger: PinoLogger,
    private readonly auditLogService: AuditLogService,
    @Inject(REALTIME_EVENT_PUBLISHER)
    private readonly realtimeEventPublisher: IRealtimeEventPublisher
  ) {
    this.logger.setContext(SessionRevocationUseCase.name);
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    await this.sessionRepository.revokeSession(userId, sessionId);

    this.logger.info(
      { event: LogEvent.SESSION_REVOKED, userId, sessionId },
      'Session revoked'
    );

    this.auditLogService.record({
      action: AuditAction.USER_LOGOUT,
      actorType: ActorType.USER,
      userId,
      resourceType: ResourceType.SESSION,
      resourceId: sessionId,
      success: true
    });

    // A revoked session's next HTTP request would already be rejected by
    // TokenValidationService, but a live socket would otherwise sit
    // connected — and keep receiving this user's events — until it
    // reconnects. Disconnect it immediately (Phase 4 rule 12/13).
    this.realtimeEventPublisher.disconnectSession(sessionId);
  }

  async revokeAll(userId: string, manager?: EntityManager): Promise<void> {
    await this.sessionRepository.revokeAllSessionsForUser(userId, manager);

    this.logger.info(
      { event: LogEvent.SESSION_REVOKED, userId },
      'All sessions revoked for user'
    );

    this.realtimeEventPublisher.disconnectUser(userId);
  }

  async terminateOthers(
    userId: string,
    sessionId: string,
    manager?: EntityManager
  ): Promise<void> {
    await this.sessionRepository.revokeSessionsExceptCurrent(
      userId,
      sessionId,
      manager
    );

    this.realtimeEventPublisher.disconnectUserExcept(userId, sessionId);
  }
}
