export interface DeviceContext {
  browserName: string;
  browserVersion: string;
  osName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  fingerprintRisk?: 'low' | 'medium' | 'high';
}
