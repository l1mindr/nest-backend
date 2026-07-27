import {
  ITokenVerificationService,
  TOKEN_VERIFICATION_SERVICE,
  ITokenValidationService,
  TOKEN_VALIDATION_SERVICE
} from '@features/token/interfaces/token.interface';
import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SecurityErrors } from '../errors/security-errors';

@Injectable()
export class JwtStrategy {
  constructor(
    @Inject(TOKEN_VERIFICATION_SERVICE)
    private readonly verificationService: ITokenVerificationService,
    @Inject(TOKEN_VALIDATION_SERVICE)
    private readonly validationService: ITokenValidationService
  ) {}

  async authenticate(req: Request) {
    const token = req.cookies?.access_token;

    if (!token) {
      throw SecurityErrors.authenticationRequired();
    }

    const payload = await this.verificationService.verifyAccess(token);

    return this.validationService.validate(payload);
  }
}
