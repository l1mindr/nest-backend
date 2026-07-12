import { SessionErrors } from '@features/sessions/errors/session-errors';
import { SessionsService } from '@features/sessions/sessions.service';
import { UsersService } from '@features/users/users.service';
import jwtConfig from '@infrastructure/config/jsonwebtoken/jwt.config';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { TokenErrors } from './errors/token-errors';
import { IJwtClaims, IJwtPayload } from './interfaces/jwt-payload.interface';
import { ITokenService } from './interfaces/token.interface';

@Injectable()
export class TokenService implements ITokenService {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService
  ) {}

  async issuePair(
    userId: string,
    sessionId: string,
    now: number,
    expiresAt: Date
  ) {
    const jwtPayload: IJwtPayload = {
      sub: userId,
      sessionId
      // role
    };

    const accessExp = Math.floor(now) / 1000 + 15 * 60;
    const refreshExp = Math.floor(expiresAt.getTime()) / 1000;

    const accessToken = await this.jwtService.signAsync(
      {
        ...jwtPayload,
        exp: accessExp
        // role
      },
      {
        secret: this.jwtConfiguration.accessTokenSecret,
        audience: 'api'
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
        audience: 'refresh'
      }
    );

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<IJwtClaims> {
    return this.jwtService.verifyAsync<IJwtClaims>(token, {
      secret: this.jwtConfiguration.accessTokenSecret,
      audience: 'api'
    });
  }

  async verifyRefreshToken(token: string): Promise<IJwtClaims> {
    return this.jwtService.verifyAsync<IJwtClaims>(token, {
      secret: this.jwtConfiguration.refreshTokenSecret,
      audience: 'refresh'
    });
  }

  async validatePayload({ sub, sessionId }: IJwtPayload): Promise<CustomAuth> {
    const user = await this.usersService.findByIdForSessionValidation(sub);

    if (!user) throw TokenErrors.invalidToken();

    const session = await this.sessionsService.getActive(user.id, sessionId);

    if (!session) throw SessionErrors.sessionExpired(sessionId);

    return { user, session };
  }
}
