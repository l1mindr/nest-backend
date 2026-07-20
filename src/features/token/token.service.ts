import { SessionErrors } from '@features/sessions/errors/session-errors';
import {
  ISessionsService,
  SESSION_SERVICE
} from '@features/sessions/interfaces/sessions.interface';
import { UserStatus } from '@features/users/enums/user-status.enum';
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
    @Inject(SESSION_SERVICE)
    private readonly sessionsService: ISessionsService
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
    try {
      return await this.jwtService.verifyAsync<IJwtClaims>(token, {
        secret: this.jwtConfiguration.accessTokenSecret,
        audience: 'api'
      });
    } catch {
      throw TokenErrors.invalidToken();
    }
  }

  async verifyRefreshToken(token: string): Promise<IJwtClaims> {
    try {
      return await this.jwtService.verifyAsync<IJwtClaims>(token, {
        secret: this.jwtConfiguration.refreshTokenSecret,
        audience: 'refresh'
      });
    } catch {
      throw TokenErrors.invalidToken();
    }
  }

  async validatePayload({ sub, sessionId }: IJwtPayload): Promise<CustomAuth> {
    const result = await this.sessionsService.getUserAndActiveSession(
      sub,
      sessionId
    );

    if (!result.user) throw TokenErrors.invalidToken();

    if (result.user.status !== UserStatus.ACTIVATE) {
      throw TokenErrors.invalidToken();
    }

    if (!result.session) throw SessionErrors.sessionExpired(sessionId);

    return { user: result.user, session: result.session };
  }
}
