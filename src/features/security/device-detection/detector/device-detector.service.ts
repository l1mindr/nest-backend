import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { DeviceContext } from '../context/device-context.interface';
import { FingerprintService } from '../fingerprint/fingerprint.service';
import { DeviceIdService } from '../identity/device-id.service';
import { UserAgentParser } from '../user-agent/user-agent.parser';
import { normalizeUA } from '../utils/normalize-ua.util';

@Injectable()
export class DeviceDetectorService {
  constructor(
    private readonly uaParser: UserAgentParser,
    private readonly fingerprintService: FingerprintService,
    private readonly deviceIdService: DeviceIdService
  ) {}

  detect(request: Request): DeviceContext {
    const ua = normalizeUA(request.headers['user-agent']);
    const parsed = this.uaParser.parse(ua);
    const { fingerprintRisk } = this.fingerprintService.analyze(parsed);

    return {
      browserName: parsed.browserName,
      browserVersion: parsed.browserVersion,
      osName: parsed.osName,
      deviceType: parsed.deviceType,
      fingerprintRisk,
      ...this.deviceIdService.resolve(request, ua)
    };
  }
}
