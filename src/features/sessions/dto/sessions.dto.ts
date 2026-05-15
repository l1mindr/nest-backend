import { IUserAgent } from '../interfaces/user-agent.interface';

export class SessionsDto {
  readonly ipAddress: string;
  readonly device: IUserAgent;
  readonly expiresAt: Date;
  readonly lastUsedAt: Date;
  readonly current?: boolean;
}
