import { Injectable } from '@nestjs/common';
import { DeviceContext } from '../context/device-context.interface';

@Injectable()
export class FingerprintService {
  analyze(device: DeviceContext) {
    let risk: 'low' | 'medium' | 'high' = 'low';

    if (!device.deviceModel) risk = 'medium';

    if (device.deviceType === 'desktop' && !device.browserName) {
      risk = 'high';
    }

    return {
      fingerprintRisk: risk,
      isTrusted: risk === 'low'
    };
  }
}
