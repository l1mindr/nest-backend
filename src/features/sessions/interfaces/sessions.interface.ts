import { SessionContext } from '@core/http/session-context.interface';
import { PaginatedResult } from '@core/pagination/paginated-result.interface';
import type { EntityManager } from 'typeorm';
import { Session } from '../entities/session.entity';
import { SessionListItem } from '../types/session-list-item.type';
import { ISessionDevice } from './session-device.interface';

export interface SessionListResult extends PaginatedResult<SessionListItem> {
  currentSession: SessionListItem;
}

export const LIST_SESSIONS_SERVICE = Symbol('IListSessionsService');

export interface IListSessionsService {
  listSessions(
    userId: string,
    session: SessionContext,
    limit?: number,
    cursor?: string
  ): Promise<SessionListResult>;
}

export const ISSUE_SESSION_SERVICE = Symbol('IIssueSessionService');

export interface IIssueSessionService {
  createSession(
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date
  ): Promise<Session>;
}

export const REVOKE_SESSION_SERVICE = Symbol('IRevokeSessionService');

export interface IRevokeSessionService {
  revokeSession(userId: string, sessionId: string): Promise<void>;
}

export const TERMINATE_OTHER_SESSIONS_SERVICE = Symbol(
  'ITerminateOtherSessionsService'
);

export interface ITerminateOtherSessionsService {
  terminateOtherSessions(
    userId: string,
    sessionId: string,
    manager?: EntityManager
  ): Promise<void>;
}

export const REVOKE_ALL_USER_SESSIONS_SERVICE = Symbol(
  'IRevokeAllUserSessionsService'
);

export interface IRevokeAllUserSessionsService {
  revokeAllSessionsForUser(
    userId: string,
    manager?: EntityManager
  ): Promise<void>;
}

export const SESSION_REPOSITORY = Symbol('ISessionRepository');

export interface ISessionRepository {
  findActiveSession(userId: string, sessionId: string): Promise<Session | null>;
  findUserWithActiveSession(
    userId: string,
    sessionId: string
  ): Promise<{
    user: import('@features/users/entities/user.entity').User | null;
    session: Session | null;
  }>;
  rotateRefreshToken(
    sessionId: string,
    version: number,
    oldHash: string,
    newHash: string,
    meta: { now: number; expiresAt: Date }
  ): Promise<boolean>;
  saveRefreshTokenHash(session: Session): Promise<Session>;
  revokeSession(userId: string, sessionId: string): Promise<void>;
  revokeAllSessionsForUser(
    userId: string,
    manager?: EntityManager
  ): Promise<void>;
  revokeSessionsExceptCurrent(
    userId: string,
    sessionId: string,
    manager?: EntityManager
  ): Promise<void>;
  listUserSessions(
    userId: string,
    currentSessionId: string,
    options: {
      now: Date;
      limit: number;
      cursor?: { lastUsedAt: Date; id: string };
    }
  ): Promise<Session[]>;
  createSession(params: {
    userId: string;
    ipAddress: string;
    device: ISessionDevice;
    expiresAt: Date;
    now: Date;
    maxSessions: number;
  }): Promise<Session>;
}
