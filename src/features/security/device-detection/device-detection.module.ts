import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DeviceDetectorService } from './detector/device-detector.service';
import { DeviceMiddleware } from './device.middleware';
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
export class DeviceDetectionModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DeviceMiddleware).forRoutes('*');
  }
}
