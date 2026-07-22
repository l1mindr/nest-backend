import { ISessionDevice } from '../interfaces/session-device.interface';

export type SessionListItem = {
  sessionId: string;
  ipAddress: string;
  deviceInfo: ISessionDevice;
  validUntil: Date;
  lastActivityAt: Date;
};
