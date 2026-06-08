import { IUserAgent } from '../user-agent/user-agent.interface';

export interface DeviceContext extends IUserAgent {
  fingerprint?: string;
  fingerprintRisk?: 'low' | 'medium' | 'high';
  isTrusted?: boolean;
}
