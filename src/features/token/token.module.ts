import { SessionsModule } from '@features/sessions/sessions.module';
import { UsersModule } from '@features/users/users.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenIssueService } from './application/services/token-issue.service';
import { TokenVerificationService } from './application/services/token-verification.service';
import { TokenValidationService } from './application/services/token-validation.service';
import {
  TOKEN_ISSUE_SERVICE,
  TOKEN_VERIFICATION_SERVICE,
  TOKEN_VALIDATION_SERVICE
} from './interfaces/token.interface';

@Module({
  imports: [JwtModule, UsersModule, SessionsModule],
  providers: [
    TokenIssueService,
    { provide: TOKEN_ISSUE_SERVICE, useExisting: TokenIssueService },
    TokenVerificationService,
    {
      provide: TOKEN_VERIFICATION_SERVICE,
      useExisting: TokenVerificationService
    },
    TokenValidationService,
    { provide: TOKEN_VALIDATION_SERVICE, useExisting: TokenValidationService }
  ],
  exports: [
    TOKEN_ISSUE_SERVICE,
    TOKEN_VERIFICATION_SERVICE,
    TOKEN_VALIDATION_SERVICE
  ]
})
export class TokenModule {}
