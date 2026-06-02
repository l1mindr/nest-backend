import { SessionErrors } from '@features/sessions/errors/session-errors';
import { SessionsService } from '@features/sessions/sessions.service';
import { UsersService } from '@features/users/users.service';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenErrors } from './errors/token-errors';
import { IJwtPayload } from './interfaces/jwt-payload.interface';
import { ITokenService } from './interfaces/token.interface';

@Injectable()
export class TokenService implements ITokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService
  ) {}

  createExpirationDate(now: number): Date {
    return new Date(now + 7 * 24 * 60 * 60 * 1000);
  }

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

    const accessToken = await this.jwtService.signAsync({
      ...jwtPayload,
      exp: accessExp
      // role
    });

    const refreshToken = await this.jwtService.signAsync({
      ...jwtPayload,
      exp: refreshExp
    });

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<IJwtPayload> {
    return this.jwtService.verifyAsync<IJwtPayload>(token);
  }

  async verifyRefreshToken(token: string): Promise<IJwtPayload> {
    return this.jwtService.verifyAsync<IJwtPayload>(token);
  }

  async validatePayload({ sub, sessionId }: IJwtPayload): Promise<CustomAuth> {
    const user = await this.usersService.findByIdForSessionValidation(sub);

    if (!user) throw TokenErrors.invalidToken();

    const session = await this.sessionsService.getActive(user.id, sessionId);

    if (!session) throw SessionErrors.sessionExpired(sessionId);

    return { user, session };
  }
}
