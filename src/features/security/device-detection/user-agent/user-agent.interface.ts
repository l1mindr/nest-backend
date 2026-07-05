export interface IUserAgent {
  browserName: string;
  browserVersion: string;
  osName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  deviceVendor?: string;
  deviceModel?: string;
}
