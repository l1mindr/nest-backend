export interface IJwtPayload {
  readonly sub: string;
  readonly sessionId: string;
  readonly role?: string;
}

export interface IJwtClaims extends IJwtPayload {
  iat: number;
  exp: number;
}
