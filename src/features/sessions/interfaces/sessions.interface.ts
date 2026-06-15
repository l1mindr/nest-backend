import { Session } from '../entities/session.entity';
import { SessionListItem } from '../types/session-list-item.type';
import { ISessionDevice } from './session-device.interface';

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

  rotateRefreshToken(
    sessionId: string,
    oldRefreshTokenHash: string,
    newRefreshTokenHash: string,
    meta: {
      lastUsedAt: Date;
      expiresAt: Date;
      rotatedAt: Date;
    }
  ): Promise<boolean>;
}
