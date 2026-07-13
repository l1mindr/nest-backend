import { CoreModule } from '@core/core.module';
import { FeaturesModule } from '@features/features.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { LoggingModule } from '@infrastructure/logging/logging.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [LoggingModule, CoreModule, InfrastructureModule, FeaturesModule]
})
export class AppModule {}
