import { ISessionDevice } from '../interfaces/session-device.interface';

export class SessionsDto {
  readonly sessionId: string;
  readonly ipAddress: string;
  readonly deviceInfo: ISessionDevice;
  readonly expiresAt: Date;
  readonly lastUsedAt: Date;
  readonly current?: boolean;
}
