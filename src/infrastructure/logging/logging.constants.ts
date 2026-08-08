export enum LogEvent {
  APPLICATION_STARTUP = 'system.startup',
  UNEXPECTED_EXCEPTION = 'system.unexpected_exception',

  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILED = 'auth.login.failed',
  LOGOUT = 'auth.logout',
  PASSWORD_CHANGED = 'auth.password.changed',
  PASSWORD_CHANGE_FAILED = 'auth.password.change_failed',
  PASSWORD_MIGRATED = 'auth.password.migrated',
  PASSWORD_MIGRATION_SKIPPED = 'auth.password.migration_skipped',
  PASSWORD_MIGRATION_FAILED = 'auth.password.migration_failed',

  REFRESH_ROTATED = 'auth.refresh.rotated',
  REFRESH_REUSE_DETECTED = 'auth.refresh.reuse_detected',

  SESSION_REVOKED = 'session.revoked',
  USER_SUSPENDED = 'user.suspended',
  USER_UNSUSPENDED = 'user.unsuspended',

  ADMIN_ROLE_GRANTED = 'authorization.admin.role_granted',
  ADMIN_ROLE_REVOKED = 'authorization.admin.role_revoked',
  ADMIN_DELETED = 'authorization.admin.deleted',
  ADMIN_STATUS_CHANGED = 'authorization.admin.status_changed',
  ADMIN_PROFILE_UPDATED = 'authorization.admin.profile_updated',
  ADMIN_INVITED = 'authorization.invitation.created',
  ADMIN_INVITATION_REVOKED = 'authorization.invitation.revoked',
  ADMIN_INVITATION_ACCEPTED = 'authorization.invitation.accepted',
  ADMIN_INVITATION_REJECTED = 'authorization.invitation.rejected',
  PERMISSIONS_GRANTED = 'authorization.permissions.granted',
  PERMISSIONS_REVOKED = 'authorization.permissions.revoked',

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
  RATE_LIMIT_ALLOWED = 'security.rate_limit.allowed',
  RATE_LIMIT_HIT = 'security.rate_limit.hit',
  RATE_LIMIT_BLOCKED = 'security.rate_limit.blocked',
  RATE_LIMIT_SKIPPED = 'security.rate_limit.skipped',
  RATE_LIMIT_DEGRADED = 'security.rate_limit.degraded',
  AUTHENTICATION_FAILED = 'security.authentication.failed',
  AUTHORIZATION_FAILED = 'security.authorization.failed',

  PENDING_USER_CLEANUP_STARTED = 'users.cleanup.pending.started',
  PENDING_USER_CLEANUP_COMPLETED = 'users.cleanup.pending.completed',
  PENDING_USER_CLEANUP_FAILED = 'users.cleanup.pending.failed',
  PENDING_USER_DEACTIVATED = 'users.cleanup.pending.deactivated',
  VERIFICATION_CODE_RETENTION_COMPLETED = 'users.cleanup.verification_codes.retained',

  EMAIL_SENT = 'email.sent',
  EMAIL_SEND_FAILED = 'email.send.failed',

  // The life of one queued email. `queued` is logged on the request path, the
  // rest by the worker; `jobId` ties them together. None of them may carry the
  // message payload, which holds verification codes and invitation tokens.
  EMAIL_JOB_QUEUED = 'email.job.queued',
  EMAIL_JOB_QUEUE_FAILED = 'email.job.queue_failed',
  EMAIL_JOB_STARTED = 'email.job.started',
  EMAIL_JOB_SENT = 'email.job.sent',
  EMAIL_JOB_RETRY = 'email.job.retry',
  EMAIL_JOB_FAILED = 'email.job.failed',

  EMAIL_VERIFIED = 'email.verify.succeeded',
  VERIFICATION_ATTEMPTS_EXCEEDED = 'email.verify.attempts_exceeded',
  VERIFICATION_RESEND_LIMIT_EXCEEDED = 'email.verify.resend_limit_exceeded'
}

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'req.headers["x-xsrf-token"]',
  'req.headers["x-device-id"]',
  'res.headers["set-cookie"]'
];
