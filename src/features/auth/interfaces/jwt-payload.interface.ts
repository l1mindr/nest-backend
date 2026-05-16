export interface IJwtPayload {
  readonly sub: string;
  readonly sessionId: string;
  readonly role?: string;
}
