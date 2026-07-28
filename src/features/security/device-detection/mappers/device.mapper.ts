import { ISessionDevice } from '@features/sessions/application/interfaces/session-device.interface';
import { Injectable } from '@nestjs/common';
import { DeviceContext } from '../context/device-context.interface';

@Injectable()
export class DeviceMapper {
  toSessionUserAgent(device: DeviceContext): ISessionDevice {
    return {
      browserName: device.browserName,
      browserVersion: device.browserVersion,
      osName: device.osName,
      deviceType: device.deviceType
    };
  }
}
