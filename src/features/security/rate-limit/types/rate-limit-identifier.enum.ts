/**
 * The dimensions a policy can key on. Each value is owned by exactly one
 * resolver; adding a member means adding a resolver, never editing an existing
 * one.
 */
export enum RateLimitIdentifier {
  IP = 'ip',
  DEVICE = 'device',
  USER = 'user',
  SESSION = 'session',
  EMAIL = 'email',
  USERNAME = 'username',
  VERIFICATION_CODE = 'code',
  ROUTE = 'route',
  CUSTOM = 'custom'
}

/**
 * Dimensions that resolve on every request regardless of body or authentication
 * state. Each policy group must contain at least one of these, so a request can
 * never slip through unlimited by omitting a field.
 */
export const ALWAYS_RESOLVABLE_IDENTIFIERS: readonly RateLimitIdentifier[] = [
  RateLimitIdentifier.IP,
  RateLimitIdentifier.DEVICE,
  RateLimitIdentifier.ROUTE
];
