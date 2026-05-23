import { IJwtPayload } from '@features/auth/interfaces/jwt-payload.interface';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ITokenService } from './interfaces/token.interface';

@Injectable()
export class TokenService implements ITokenService {
  constructor(private readonly jwtService: JwtService) {}

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
}
