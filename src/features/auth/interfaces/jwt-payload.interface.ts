export interface JwtPayload {
  readonly sub: string;
  readonly sessionId: string;
  readonly role?: string;
}
