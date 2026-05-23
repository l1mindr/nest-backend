import { IJwtPayload } from '@features/auth/interfaces/jwt-payload.interface';

export type issuedTokens = {
  accessToken: string;
  refreshToken: string;
};

export interface ITokenService {
  issuePair(
    userId: string,
    sessionId: string,
    now: number,
    expiresAt: Date
  ): Promise<issuedTokens>;
  verifyAccessToken(token: string): Promise<IJwtPayload>;
  verifyRefreshToken(token: string): Promise<IJwtPayload>;
}
