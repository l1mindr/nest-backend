import { Module } from '@nestjs/common';
import { DeviceDetectorService } from './detector/device-detector.service';
import { FingerprintService } from './fingerprint/fingerprint.service';
import { UserAgentParser } from './user-agent/user-agent.parser';

@Module({
  providers: [DeviceDetectorService, UserAgentParser, FingerprintService],

  exports: [DeviceDetectorService]
})
export class DeviceModule {}
