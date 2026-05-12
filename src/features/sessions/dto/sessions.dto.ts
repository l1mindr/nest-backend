import { IDevice } from '../interfaces/device.interface';
import { IUserAgent } from '../interfaces/user-agent.interface';

export class SessionsDto {
  readonly ip: string;
  readonly expiryDate: Date;
  readonly device: IDevice;
  readonly current?: boolean;
}

export class SessionsDtoUpdate {
  readonly ipAddress: string;
  readonly userAgent: IUserAgent;
  readonly expiresAt: Date;
  readonly lastUsedAt: Date;
  readonly current?: boolean;
}
