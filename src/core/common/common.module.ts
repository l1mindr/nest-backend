import { Module, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { DataResponseInterceptor } from '../../infrastructure/http/interceptors/data-response.interceptor';
import { VALIDATION_PIPE_OPTIONS } from '../../infrastructure/http/validation/pipe/validation.constants';

@Module({
  imports: [],
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
