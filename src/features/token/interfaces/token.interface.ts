import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { IJwtClaims, IJwtPayload } from './jwt-payload.interface';

export type issuedTokens = {
  accessToken: string;
  refreshToken: string;
};

export const TOKEN_SERVICE = Symbol('ITokenService');

export interface ITokenService {
  issuePair(
    userId: string,
    sessionId: string,
    now: number,
    expiresAt: Date
  ): Promise<issuedTokens>;
  verifyAccessToken(token: string): Promise<IJwtClaims>;
  verifyRefreshToken(token: string): Promise<IJwtClaims>;
  validatePayload(payload: IJwtPayload): Promise<CustomAuth>;
}
