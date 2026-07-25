import { DeviceContext } from './device-context.interface';

export interface SessionContext {
  readonly id: string;
  readonly ipAddress: string;
  readonly device: DeviceContext;
  readonly expiresAt: Date;
  readonly lastUsedAt: Date;
}
