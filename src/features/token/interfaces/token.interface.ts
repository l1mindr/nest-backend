import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { IJwtClaims, IJwtPayload } from './jwt-payload.interface';

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
};

export const TOKEN_ISSUE_SERVICE = Symbol('ITokenIssueService');

export interface ITokenIssueService {
  issuePair(
    userId: string,
    sessionId: string,
    now: number,
    expiresAt: Date
  ): Promise<IssuedTokens>;
}

export const TOKEN_VERIFICATION_SERVICE = Symbol('ITokenVerificationService');

export interface ITokenVerificationService {
  verifyAccess(token: string): Promise<IJwtClaims>;
  verifyRefresh(token: string): Promise<IJwtClaims>;
}

export const TOKEN_VALIDATION_SERVICE = Symbol('ITokenValidationService');

export interface ITokenValidationService {
  validate(payload: IJwtPayload): Promise<CustomAuth>;
}
