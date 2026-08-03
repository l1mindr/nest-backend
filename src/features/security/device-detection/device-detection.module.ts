import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SecurityHashingModule } from '../hashing/security-hashing.module';
import { DeviceDetectorService } from './detector/device-detector.service';
import { DeviceMiddleware } from './device.middleware';
import { FingerprintService } from './fingerprint/fingerprint.service';
import { DeviceIdService } from './identity/device-id.service';
import { DeviceMapper } from './mappers/device.mapper';
import { UserAgentParser } from './user-agent/user-agent.parser';

@Module({
  imports: [SecurityHashingModule],

  providers: [
    DeviceDetectorService,
    UserAgentParser,
    FingerprintService,
    DeviceIdService,
    DeviceMapper
  ],

  exports: [DeviceDetectorService, DeviceMapper]
})
export class DeviceDetectionModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DeviceMiddleware).forRoutes('*');
  }
}
