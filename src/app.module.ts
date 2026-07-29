import { CoreModule } from '@core/core.module';
import { FeaturesModule } from '@features/features.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { LoggingModule } from '@infrastructure/logging/logging.module';
import { PresentationModule } from '@presentation/presentation.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    LoggingModule,
    CoreModule,
    PresentationModule,
    InfrastructureModule,
    FeaturesModule
  ]
})
export class AppModule {}
