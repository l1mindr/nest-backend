import { LogEvent } from '@infrastructure/logging/logging.constants';
import {
  ActorType,
  AuditAction,
  ResourceType
} from '@infrastructure/logging/mongodb/mongodb.constants';
import { AuditLogService } from '@infrastructure/logging/audit/audit-log.service';
import {
  IUserActivityRecorder,
  USER_ACTIVITY_RECORDER
} from '@features/activity/application/interfaces/activity.interface';
import { ActivityAction } from '@features/activity/domain/enums/activity-action.enum';
import { ActivityCategory } from '@features/activity/domain/enums/activity-category.enum';
import {
  IRealtimeEventPublisher,
  REALTIME_EVENT_PUBLISHER
} from '@features/realtime/application/interfaces/realtime.interface';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SessionErrors } from '../../domain/errors/session-errors';
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
    private readonly realtimeEventPublisher: IRealtimeEventPublisher,
    @Inject(USER_ACTIVITY_RECORDER)
    private readonly activityRecorder: IUserActivityRecorder
  ) {
    this.logger.setContext(SessionRevocationUseCase.name);
  }

  /**
   * Revokes one of the caller's other sessions.
   *
   * `revoke` writes through a `userId`-scoped update, so it cannot touch
   * another account's session — but an id that matches nothing updates zero
   * rows and reports success, which would tell the user a device was signed
   * out when it was not. This looks the session up first so a wrong or already
   * revoked id is a 404 rather than a silent no-op.
   *
   * Refuses the current session outright: ending that is a logout, and the
   * route for it clears the auth cookies as well.
   */
  async revokeOwned(
    userId: string,
    currentSessionId: string,
    targetSessionId: string
  ): Promise<void> {
    if (targetSessionId === currentSessionId) {
      throw SessionErrors.sessionIsCurrent(targetSessionId);
    }

    const session = await this.sessionRepository.findActiveSession(
      userId,
      targetSessionId
    );

    if (!session) {
      throw SessionErrors.sessionNotFound(targetSessionId);
    }

    await this.performRevoke(userId, targetSessionId);

    // Signing another device out, not signing yourself out — a different fact
    // to the user, and the reason this does not go through `revoke()`.
    this.activityRecorder.record({
      userId,
      category: ActivityCategory.SECURITY,
      action: ActivityAction.SESSION_REVOKED,
      entityType: 'SESSION',
      entityId: targetSessionId
    });
  }

  /**
   * Ends the caller's own session.
   *
   * Reached by the logout route and by refresh-token reuse detection, so the
   * activity it records is `LOGOUT`. Revoking *another* device goes through
   * `revokeOwned`, which records `SESSION_REVOKED` instead.
   */
  async revoke(userId: string, sessionId: string): Promise<void> {
    await this.performRevoke(userId, sessionId);

    this.activityRecorder.record({
      userId,
      category: ActivityCategory.SECURITY,
      action: ActivityAction.LOGOUT,
      entityType: 'SESSION',
      entityId: sessionId
    });
  }

  /** The revocation itself, without deciding what the user did to cause it. */
  private async performRevoke(
    userId: string,
    sessionId: string
  ): Promise<void> {
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

    // One row for the whole action rather than one per session: the user
    // performed a single "sign out everywhere else", and that is what a
    // history screen should show them.
    this.activityRecorder.record({
      userId,
      category: ActivityCategory.SECURITY,
      action: ActivityAction.SESSION_REVOKED,
      metadata: { scope: 'OTHERS' }
    });
  }
}
