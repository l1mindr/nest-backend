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
  USER_SUSPENDED = 'user.suspended',
  USER_UNSUSPENDED = 'user.unsuspended',

  COIN_SYNC_STARTED = 'coin_tracker.sync.started',
  COIN_SYNC_COMPLETED = 'coin_tracker.sync.completed',
  COIN_SYNC_FAILED = 'coin_tracker.sync.failed',
  COIN_SYNC_SKIPPED = 'coin_tracker.sync.skipped',

  PRICE_ALERT_CREATED = 'coin_tracker.alert.created',
  PRICE_ALERT_UPDATED = 'coin_tracker.alert.updated',
  PRICE_ALERT_TRIGGERED = 'coin_tracker.alert.triggered',
  PRICE_ALERT_EXPIRED = 'coin_tracker.alert.expired',
  PRICE_ALERT_CANCELLED = 'coin_tracker.alert.cancelled',
  PRICE_ALERT_SKIPPED = 'coin_tracker.alert.skipped',
  PRICE_CHECK_STARTED = 'coin_tracker.price_check.started',
  PRICE_CHECK_COMPLETED = 'coin_tracker.price_check.completed',
  PRICE_CHECK_FAILED = 'coin_tracker.price_check.failed',
  PRICE_CHECK_SKIPPED = 'coin_tracker.price_check.skipped',

  NOTIFICATION_SENT = 'coin_tracker.notification.sent',

  RATE_LIMIT_EXCEEDED = 'security.rate_limit.exceeded',
  AUTHENTICATION_FAILED = 'security.authentication.failed',
  AUTHORIZATION_FAILED = 'security.authorization.failed',

  PENDING_USER_CLEANUP_STARTED = 'users.cleanup.pending.started',
  PENDING_USER_CLEANUP_COMPLETED = 'users.cleanup.pending.completed',
  PENDING_USER_CLEANUP_FAILED = 'users.cleanup.pending.failed',
  PENDING_USER_DEACTIVATED = 'users.cleanup.pending.deactivated'
}

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'req.headers["x-xsrf-token"]',
  'res.headers["set-cookie"]'
];
