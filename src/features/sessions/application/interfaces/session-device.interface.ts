export interface ISessionDevice {
  browserName: string;
  browserVersion: string;
  osName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}
