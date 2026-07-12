import { TokenService } from '@features/token/token.service';
import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SecurityErrors } from '../errors/security-errors';

@Injectable()
export class JwtStrategy {
  constructor(private readonly tokenService: TokenService) {}

  async authenticate(req: Request) {
    const token = req.cookies?.access_token;

    if (!token) {
      throw SecurityErrors.authenticationRequired();
    }

    const payload = await this.tokenService.verifyAccessToken(token);

    return this.tokenService.validatePayload(payload);
  }
}
