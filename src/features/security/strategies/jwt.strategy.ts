import {
  ITokenService,
  TOKEN_SERVICE
} from '@features/token/interfaces/token.interface';
import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SecurityErrors } from '../errors/security-errors';

@Injectable()
export class JwtStrategy {
  constructor(
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService
  ) {}

  async authenticate(req: Request) {
    const token = req.cookies?.access_token;

    if (!token) {
      throw SecurityErrors.authenticationRequired();
    }

    const payload = await this.tokenService.verifyAccessToken(token);

    return this.tokenService.validatePayload(payload);
  }
}
