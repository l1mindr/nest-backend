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
  list(
    userId: string,
    session: Session,
    limit?: number,
    cursor?: string
  ): Promise<SessionListResult>;
}

export const ISSUE_SESSION_SERVICE = Symbol('IIssueSessionService');

export interface IIssueSessionService {
  issue(
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date
  ): Promise<Session>;
}

export const REVOKE_SESSION_SERVICE = Symbol('IRevokeSessionService');

export interface IRevokeSessionService {
  revoke(userId: string, sessionId: string): Promise<void>;
}

export const TERMINATE_OTHER_SESSIONS_SERVICE = Symbol(
  'ITerminateOtherSessionsService'
);

export interface ITerminateOtherSessionsService {
  terminateOthers(
    userId: string,
    sessionId: string,
    manager?: EntityManager
  ): Promise<void>;
}

export const REVOKE_ALL_USER_SESSIONS_SERVICE = Symbol(
  'IRevokeAllUserSessionsService'
);

export interface IRevokeAllUserSessionsService {
  revokeAllForUser(userId: string, manager?: EntityManager): Promise<void>;
}

export const SESSION_REPOSITORY = Symbol('ISessionRepository');

export interface ISessionRepository {
  getActive(userId: string, sessionId: string): Promise<Session | null>;
  getUserAndActiveSession(
    userId: string,
    sessionId: string
  ): Promise<{
    user: import('@features/users/entities/user.entity').User | null;
    session: Session | null;
  }>;
  rotateAtomic(
    sessionId: string,
    version: number,
    oldHash: string,
    newHash: string,
    meta: { now: number; expiresAt: Date }
  ): Promise<boolean>;
}
