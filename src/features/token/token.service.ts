import { SessionErrors } from '@features/sessions/errors/session-errors';
import {
  ISessionRepository,
  SESSION_REPOSITORY
} from '@features/sessions/interfaces/sessions.interface';
import { UserStatus } from '@features/users/enums/user-status.enum';
import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/interfaces/users.interface';
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
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
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

  async findUserAndActiveSession({
    sub,
    sessionId
  }: IJwtPayload): Promise<CustomAuth> {
    const user = await this.userRepository.findUserForTokenValidation(sub);

    if (!user) throw TokenErrors.invalidToken();

    if (user.status !== UserStatus.ACTIVATE) {
      throw TokenErrors.invalidToken();
    }

    const session = await this.sessionRepository.findActiveSession(
      sub,
      sessionId
    );

    if (!session) throw SessionErrors.sessionExpired(sessionId);

    return { user, session };
  }
}
