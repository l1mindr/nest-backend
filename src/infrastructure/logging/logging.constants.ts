export enum LogEvent {
  APPLICATION_STARTUP = 'system.startup',
  UNEXPECTED_EXCEPTION = 'system.unexpected_exception',

  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILED = 'auth.login.failed',
  LOGOUT = 'auth.logout',
  PASSWORD_CHANGED = 'auth.password.changed',
  PASSWORD_CHANGE_FAILED = 'auth.password.change_failed',

  REFRESH_ROTATED = 'auth.refresh.rotated',
  REFRESH_REUSE_DETECTED = 'auth.refresh.reuse_detected',

  SESSION_REVOKED = 'session.revoked',

  RATE_LIMIT_EXCEEDED = 'security.rate_limit.exceeded',
  AUTHENTICATION_FAILED = 'security.authentication.failed',
  AUTHORIZATION_FAILED = 'security.authorization.failed'
}

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'req.headers["x-xsrf-token"]',
  'res.headers["set-cookie"]'
];
