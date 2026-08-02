import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { VALIDATION_PIPE_OPTIONS } from './validation/pipe/validation.constants';

@Module({
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe(VALIDATION_PIPE_OPTIONS)
    }
  ]
})
export class PresentationModule {}
