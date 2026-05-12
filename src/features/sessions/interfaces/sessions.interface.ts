import { User } from '@features/users/entities/user.entity';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { Session } from '../entities/session.entity';
import { ISessionWithCurrentUpdate } from './session-with-current.interface';
import { IUserAgent } from './user-agent.interface';

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
};

export interface ISessionsService {
  getActive(userId: string, token: string): Promise<Session | null>;
  issue(
    userId: string,
    ipAddress: string,
    userAgent: IUserAgent
  ): Promise<IssuedTokens>;
  list(customAuth: CustomAuth): Promise<ISessionWithCurrentUpdate[]>;
  revoke(user: User, token: string): Promise<void>;
  terminateOthers(user: User, token: string): Promise<void>;
}
