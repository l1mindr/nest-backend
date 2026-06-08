export interface ISessionUserAgent {
  browserName: string;
  browserVersion: string;
  osName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}
