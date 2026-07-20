import type { EntityManager } from 'typeorm';
import { Session } from '../entities/session.entity';
import { SessionListItem } from '../types/session-list-item.type';
import { ISessionDevice } from './session-device.interface';

export const SESSION_SERVICE = Symbol('ISessionsService');

export interface ISessionsService {
  getActive(userId: string, sessionId: string): Promise<Session | null>;
  getUserAndActiveSession(
    userId: string,
    sessionId: string
  ): Promise<{
    user: import('@features/users/entities/user.entity').User | null;
    session: Session | null;
  }>;

  issue(
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date
  ): Promise<Session>;

  list(userId: string, session: Session): Promise<SessionListItem[]>;

  revoke(userId: string, sessionId: string): Promise<void>;

  terminateOthers(
    userId: string,
    sessionId: string,
    manager?: EntityManager
  ): Promise<void>;

  /**
   * Revoke every non-revoked session belonging to the user. Accepts an
   * EntityManager so callers (e.g. account deletion) can run it inside a
   * transaction alongside their own writes.
   */
  revokeAllForUser(userId: string, manager?: EntityManager): Promise<void>;

  updateRefreshState(
    session: Session,
    payload: Partial<Session>
  ): Promise<void>;

  rotateAtomic(
    sessionId: string,
    version: number,
    oldHash: string,
    newHash: string,
    meta: {
      now: number;
      expiresAt: Date;
    }
  ): Promise<boolean>;
}
