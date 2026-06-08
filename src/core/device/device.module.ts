import { Module } from '@nestjs/common';
import { DeviceDetectorService } from './detector/device-detector.service';
import { FingerprintService } from './fingerprint/fingerprint.service';
import { DeviceMapper } from './mappers/device.mapper';
import { UserAgentParser } from './user-agent/user-agent.parser';

@Module({
  providers: [
    DeviceDetectorService,
    UserAgentParser,
    FingerprintService,
    DeviceMapper
  ],

  exports: [DeviceDetectorService, DeviceMapper]
})
export class DeviceModule {}
