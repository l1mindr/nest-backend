/**
 * Names shared by the OpenAPI document builder and the per-endpoint
 * decorators. Keeping them in one place is what stops a `@ApiCookieAuth()`
 * from referencing a security scheme that was never registered.
 */

/** Security scheme identifiers registered on the OpenAPI document. */
export const SecurityScheme = {
  ACCESS_TOKEN: 'accessTokenCookie',
  REFRESH_TOKEN: 'refreshTokenCookie',
  CSRF_TOKEN: 'csrfToken'
} as const;

/** Cookies issued and consumed by the API. */
export const AuthCookie = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  CSRF_TOKEN: 'csrf_token'
} as const;

/** Header carrying the double-submit CSRF token. */
export const CSRF_HEADER = 'x-csrf-token';

/** Tags used to group operations. Every controller must use one of these. */
export const ApiTagName = {
  AUTHENTICATION: 'Authentication',
  USER_PROFILE: 'User Profile',
  SESSIONS: 'Sessions',
  COINS: 'Coins',
  PRICE_ALERTS: 'Price Alerts',
  ADMIN_USERS: 'Admin Users'
} as const;

/**
 * Representative values reused across examples so that the rendered
 * documentation reads like a real API transcript rather than placeholders.
 */
export const ExampleValue = {
  USER_ID: '7c4f2f6a-1f2d-4a1b-9c3e-8d5b6a0e1f24',
  ADMIN_ID: '2f9a1c73-64d8-4f0e-b1a7-3c5e9d2b8a10',
  SESSION_ID: 'e4f8b9a2-1c7d-4d5a-8f3e-9a1b2c3d4e5f',
  PRICE_ALERT_ID: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
  EMAIL: 'mohammad.reza@example.com',
  USERNAME: 'mohammad_reza',
  NAME: 'Mohammad Reza',
  PASSWORD: 'Str0ng!Pass',
  VERIFICATION_CODE: '481902',
  CSRF_TOKEN:
    '9f1c0b7d4e2a6c8f3b5d7e9a1c3f5b7d.1767225600000.4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b',
  CURSOR: 'N2M0ZjJmNmEtMWYyZC00YTFiLTljM2UtOGQ1YjZhMGUxZjI0',
  TIMESTAMP: '2026-08-02T14:35:00.000Z',
  EXPIRES_AT: '2027-01-01T00:00:00.000Z'
} as const;
