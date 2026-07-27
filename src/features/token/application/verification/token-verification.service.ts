import jwtConfig from '@infrastructure/config/jsonwebtoken/jwt.config';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenErrors } from '../../errors/token-errors';
import { IJwtClaims } from '../../interfaces/jwt-payload.interface';
import { ITokenVerificationService } from '../../interfaces/token.interface';

@Injectable()
export class TokenVerificationService implements ITokenVerificationService {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly jwtService: JwtService
  ) {}

  async verifyAccess(token: string): Promise<IJwtClaims> {
    try {
      return await this.jwtService.verifyAsync<IJwtClaims>(token, {
        secret: this.jwtConfiguration.accessTokenSecret,
        audience: 'api'
      });
    } catch {
      throw TokenErrors.invalidToken();
    }
  }

  async verifyRefresh(token: string): Promise<IJwtClaims> {
    try {
      return await this.jwtService.verifyAsync<IJwtClaims>(token, {
        secret: this.jwtConfiguration.refreshTokenSecret,
        audience: 'refresh'
      });
    } catch {
      throw TokenErrors.invalidToken();
    }
  }
}
