import { IDevice } from './device.interface';
import { IUserAgent } from './user-agent.interface';

export interface ISessionWithCurrent {
  ip: string;
  expiryDate: Date;
  device: IDevice;
  current?: boolean;
}

export interface ISessionWithCurrentUpdate {
  ipAddress: string;
  expiresAt: Date;
  userAgent: IUserAgent;
  lastUsedAt: Date;
  current?: boolean;
}
