import jwtConfig from '@infrastructure/config/jsonwebtoken/jwt.config';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { IJwtPayload } from '../../interfaces/jwt-payload.interface';
import {
  IssuedTokens,
  ITokenIssueService
} from '../../interfaces/token.interface';

@Injectable()
export class TokenIssueService implements ITokenIssueService {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly jwtService: JwtService
  ) {}

  async issuePair(
    userId: string,
    sessionId: string,
    now: number,
    expiresAt: Date
  ): Promise<IssuedTokens> {
    const jwtPayload: IJwtPayload = {
      sub: userId,
      sessionId
    };

    const accessExp = Math.floor(now) / 1000 + 15 * 60;
    const refreshExp = Math.floor(expiresAt.getTime()) / 1000;

    const accessToken = await this.jwtService.signAsync(
      {
        ...jwtPayload,
        exp: accessExp
      },
      {
        secret: this.jwtConfiguration.accessTokenSecret,
        audience: 'api',
        algorithm: 'HS256'
      }
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        ...jwtPayload,
        exp: refreshExp,
        jti: randomUUID()
      },
      {
        secret: this.jwtConfiguration.refreshTokenSecret,
        audience: 'refresh',
        algorithm: 'HS256'
      }
    );

    return { accessToken, refreshToken };
  }
}
