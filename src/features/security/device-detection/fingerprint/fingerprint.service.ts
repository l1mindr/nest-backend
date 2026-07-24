import { Injectable } from '@nestjs/common';
import { DeviceContext } from '../context/device-context.interface';

@Injectable()
export class FingerprintService {
  analyze(device: DeviceContext) {
    const risk = this.evaluateRisk(device);

    return {
      fingerprintRisk: risk
    };
  }

  private evaluateRisk({
    browserName,
    browserVersion,
    osName
  }: DeviceContext): 'low' | 'medium' | 'high' {
    if (browserName === 'unknown' && osName === 'unknown') {
      return 'high';
    }

    if (browserName === 'unknown' || osName === 'unknown') {
      return 'medium';
    }

    if (browserVersion === 'unknown') {
      return 'medium';
    }

    return 'low';
  }
}
