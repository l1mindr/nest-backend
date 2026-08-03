export type DeviceIdSource = 'header' | 'derived';

export interface DeviceIdentity {
  /** The identifier rate limiting keys on. */
  readonly deviceId: string;
  /**
   * The server-derived identifier, populated even when a client header supplied
   * `deviceId`. Keeping both means the device dimension can be re-pointed at the
   * unspoofable value without a data migration.
   */
  readonly derivedDeviceId: string;
  readonly deviceIdSource: DeviceIdSource;
}
