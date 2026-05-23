import { CoreModule } from '@core/core.module';
import { FeaturesModule } from '@features/features.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [SharedModule, CoreModule, InfrastructureModule, FeaturesModule]
})
export class AppModule {}
