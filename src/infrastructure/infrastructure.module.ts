import { Module, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { EnvModule } from './config/env/env.module';
import { DatabasesModule } from './databases/databases.module';
import { DataResponseInterceptor } from './http/interceptors/data-response.interceptor';
import { VALIDATION_PIPE_OPTIONS } from './http/validation/pipe/validation.constants';

@Module({
  imports: [EnvModule, DatabasesModule],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe(VALIDATION_PIPE_OPTIONS)
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DataResponseInterceptor
    }
  ]
})
export class InfrastructureModule {}
