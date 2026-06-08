import { ISessionUserAgent } from '../interfaces/session-user-agent.interface';

export class SessionsDto {
  readonly sessionId: string;
  readonly ipAddress: string;
  readonly device: ISessionUserAgent;
  readonly expiresAt: Date;
  readonly lastUsedAt: Date;
  readonly current?: boolean;
}
