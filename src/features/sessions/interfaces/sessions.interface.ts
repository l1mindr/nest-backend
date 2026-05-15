import { User } from '@features/users/entities/user.entity';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { SessionsDto } from '../dto/sessions.dto';
import { Session } from '../entities/session.entity';
import { IUserAgent } from './user-agent.interface';
import { AuthTokens } from '@features/auth/interfaces/auth.interface';

export interface ISessionsService {
  getActive(userId: string, sessionId: string): Promise<Session | null>;
  issue(
    userId: string,
    ipAddress: string,
    userAgent: IUserAgent
  ): Promise<AuthTokens>;
  refresh(refreshToken: string): Promise<AuthTokens>;
  list(customAuth: CustomAuth): Promise<SessionsDto[]>;
  revoke(user: User, sessionId: string): Promise<void>;
  terminateOthers(user: User, sessionId: string): Promise<void>;
}
