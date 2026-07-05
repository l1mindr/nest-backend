import { IJwtPayload } from '@features/token/interfaces/jwt-payload.interface';
import { TokenService } from '@features/token/token.service';
import jwtConfig from '@infrastructure/config/jsonwebtoken/jwt.config';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { SecurityErrors } from '../errors/security-errors';

@Injectable()
export class JwtStrategy {
  constructor(
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>
  ) {}

  async authenticate(req: Request) {
    const token = req.cookies?.access_token;

    if (!token) {
      throw SecurityErrors.authenticationRequired();
    }

    const payload = await this.jwtService.verifyAsync<IJwtPayload>(token, {
      secret: this.jwtConfiguration.secret
    });

    return this.tokenService.validatePayload(payload);
  }
}
