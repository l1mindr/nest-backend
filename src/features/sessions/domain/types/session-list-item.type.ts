import { ISessionDevice } from '../../application/interfaces/session-device.interface';

export type SessionListItem = {
  sessionId: string;
  ipAddress: string;
  deviceInfo: ISessionDevice;
  expiresAt: Date;
  lastActivityAt: Date;
};
