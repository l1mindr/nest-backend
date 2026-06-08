import { ISessionUserAgent } from '@features/sessions/interfaces/session-user-agent.interface';
import { Injectable } from '@nestjs/common';
import { DeviceContext } from '../context/device-context.interface';

@Injectable()
export class DeviceMapper {
  toSessionUserAgent(device: DeviceContext): ISessionUserAgent {
    return {
      browserName: device.browserName,
      browserVersion: device.browserVersion,
      osName: device.osName,
      deviceType: device.deviceType
    };
  }
}
