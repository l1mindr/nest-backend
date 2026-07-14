import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { FingerprintService } from '../fingerprint/fingerprint.service';
import { UserAgentParser } from '../user-agent/user-agent.parser';
import { normalizeUA } from '../utils/normalize-ua.util';

@Injectable()
export class DeviceDetectorService {
  constructor(
    private readonly uaParser: UserAgentParser,
    private readonly fingerprintService: FingerprintService
  ) {}

  detect(request: Request) {
    const ua = normalizeUA(request.headers['user-agent']);
    const device = this.uaParser.parse(ua);

    const fingerprint = this.fingerprintService.analyze(device);

    return {
      browserName: device.browserName,
      browserVersion: device.browserVersion,
      osName: device.osName,
      deviceType: device.deviceType,
      ...fingerprint
    };
  }
}
