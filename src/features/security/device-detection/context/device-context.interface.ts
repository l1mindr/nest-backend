import { IUserAgent } from '../user-agent/user-agent.interface';

export interface DeviceContext extends IUserAgent {
  fingerprintRisk?: 'low' | 'medium' | 'high';
}
