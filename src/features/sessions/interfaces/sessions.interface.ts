import { User } from '@features/users/entities/user.entity';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { Session } from '../entities/session.entity';
import { SessionListItem } from '../types/session-list-item.type';
import { IUserAgent } from './user-agent.interface';

export interface ISessionsService {
  getActive(userId: string, sessionId: string): Promise<Session | null>;
  issue(
    userId: string,
    ipAddress: string,
    userAgent: IUserAgent,
    expiresAt: Date
  ): Promise<Session>;
  list(customAuth: CustomAuth): Promise<SessionListItem[]>;
  revoke(user: User, sessionId: string): Promise<void>;
  terminateOthers(user: User, sessionId: string): Promise<void>;
  updateRefreshState(
    session: Session,
    payload: Partial<Session>
  ): Promise<void>;
}
