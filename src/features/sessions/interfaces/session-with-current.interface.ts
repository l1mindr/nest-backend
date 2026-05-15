import { IUserAgent } from './user-agent.interface';

export interface ISessionWithCurrent {
  ipAddress: string;
  expiresAt: Date;
  userAgent: IUserAgent;
  lastUsedAt: Date;
  current?: boolean;
}
