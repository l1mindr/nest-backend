import { Module } from '@nestjs/common';
import { CsrfTokenService } from './services/csrf-token.service';
import { CsrfValidationService } from './services/csrf-validation.service';

@Module({
  providers: [CsrfTokenService, CsrfValidationService],
  exports: [CsrfTokenService, CsrfValidationService]
})
export class CsrfModule {}
