import { CoreModule } from '@core/core.module';
import { DeviceMiddleware } from '@core/device/device.middleware';
import { FeaturesModule } from '@features/features.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { MiddlewareConsumer, Module } from '@nestjs/common';

@Module({
  imports: [CoreModule, InfrastructureModule, FeaturesModule]
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DeviceMiddleware).forRoutes('*');
  }
}
