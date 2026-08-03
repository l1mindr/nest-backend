export interface DeviceContext {
  browserName: string;
  browserVersion: string;
  osName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  fingerprintRisk?: 'low' | 'medium' | 'high';
  /**
   * Stable per-device handle used by rate limiting. Optional because callers
   * that build a device descriptor by hand (session fixtures, mappers) have no
   * request to derive it from.
   */
  deviceId?: string;
  /** Always the server-derived value, even when a client header supplied `deviceId`. */
  derivedDeviceId?: string;
  deviceIdSource?: 'header' | 'derived';
}
