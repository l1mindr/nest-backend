import { User } from '@features/users/entities/user.entity';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { Session } from '../entities/session.entity';
import { ISessionWithCurrent } from './session-with-current.interface';
import { IUserAgent } from './user-agent.interface';

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
};

export interface ISessionsService {
  getActive(userId: string, sessionId: string): Promise<Session | null>;
  issue(
    userId: string,
    ipAddress: string,
    userAgent: IUserAgent
  ): Promise<IssuedTokens>;
  refresh(refreshToken: string): Promise<IssuedTokens>;
  list(customAuth: CustomAuth): Promise<ISessionWithCurrent[]>;
  revoke(user: User, sessionId: string): Promise<void>;
  terminateOthers(user: User, sessionId: string): Promise<void>;
}
