import { Module, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { DataResponseInterceptor } from './interceptors/data-response.interceptor';
import { VALIDATION_PIPE_OPTIONS } from './validation/validation.constants';
import { EnvModule } from './env/env.module';

@Module({
  imports: [EnvModule],
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
export class CommonModule {}
