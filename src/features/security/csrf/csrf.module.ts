import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CsrfService } from './csrf.service';
import { CsrfGuard } from './guards/csrf.guard';

@Module({
  providers: [
    CsrfService,
    {
      provide: APP_GUARD,
      useClass: CsrfGuard
    }
  ],
  exports: [CsrfService]
})
export class CsrfModule {}
