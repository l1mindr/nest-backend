import { Session } from '../entities/session.entity';
import { SessionListItem } from '../types/session-list-item.type';
import { ISessionDevice } from './session-device.interface';

export const SESSION_SERVICE = Symbol('ISessionsService');

export interface ISessionsService {
  getActive(userId: string, sessionId: string): Promise<Session | null>;

  issue(
    userId: string,
    ipAddress: string,
    device: ISessionDevice,
    expiresAt: Date
  ): Promise<Session>;

  list(userId: string, session: Session): Promise<SessionListItem[]>;

  revoke(userId: string, sessionId: string): Promise<void>;

  terminateOthers(userId: string, sessionId: string): Promise<void>;

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
