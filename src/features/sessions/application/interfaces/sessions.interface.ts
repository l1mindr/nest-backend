import { SessionContext } from '@core/http/session-context.interface';
import { PaginatedResult } from '@core/pagination/paginated-result.interface';
import type { EntityManager } from 'typeorm';
import { Session } from '../../domain/entities/session.entity';
import { SessionListItem } from '../../domain/types/session-list-item.type';
import { ISessionDevice } from './session-device.interface';

export interface SessionListResult extends PaginatedResult<SessionListItem> {
  currentSession: SessionListItem;
}

export const SESSION_ISSUE_USE_CASE = Symbol('ISessionIssueUseCase');
export interface ISessionIssueUseCase {
  execute(
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date
  ): Promise<Session>;
}

export const SESSION_QUERY_SERVICE = Symbol('ISessionQueryService');
export interface ISessionQueryService {
  findActive(userId: string, sessionId: string): Promise<Session | null>;
}

export const SESSION_LIST_SERVICE = Symbol('ISessionListService');
export interface ISessionListService {
  list(
    userId: string,
    session: SessionContext,
    limit?: number,
    cursor?: string
  ): Promise<SessionListResult>;
}

export const SESSION_ROTATION_USE_CASE = Symbol('ISessionRotationUseCase');
export interface ISessionRotationUseCase {
  execute(
    sessionId: string,
    version: number,
    oldHash: string,
    newHash: string,
    meta: { now: number; expiresAt: Date }
  ): Promise<boolean>;
  saveHash(session: Session): Promise<Session>;
}

export const SESSION_REVOCATION_USE_CASE = Symbol('ISessionRevocationUseCase');
export interface ISessionRevocationUseCase {
  revoke(userId: string, sessionId: string): Promise<void>;
  revokeAll(userId: string, manager?: EntityManager): Promise<void>;
  terminateOthers(
    userId: string,
    sessionId: string,
    manager?: EntityManager
  ): Promise<void>;
}

export const SESSION_CURSOR_SERVICE = Symbol('ISessionCursorService');
export interface ISessionCursorService {
  encode(data: { lastUsedAt: Date; id: string }): string;
  decode(cursor?: string): { lastUsedAt: Date; id: string } | null;
}

export const SESSION_REPOSITORY = Symbol('ISessionRepository');
export interface ISessionRepository {
  findActiveSession(userId: string, sessionId: string): Promise<Session | null>;
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
  countActiveSessions(
    userId: string,
    now: Date,
    manager?: EntityManager
  ): Promise<number>;
  createSession(params: {
    userId: string;
    ipAddress: string;
    device: ISessionDevice;
    expiresAt: Date;
    now: Date;
    manager?: EntityManager;
  }): Promise<Session>;
}
