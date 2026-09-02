export const EMAIL_TRANSPORT = Symbol('EMAIL_TRANSPORT');

export const SMTP_POOL_MAX_CONNECTIONS = 5;
export const SMTP_POOL_MAX_MESSAGES = 100;

/**
 * Deadlines for the three stages of an SMTP conversation that can hang.
 *
 * Nodemailer leaves all three unbounded by default, so a server that accepts a
 * TCP connection and then stops responding — a filtered port, a provider
 * throttling a sender — holds a queue worker forever rather than failing into
 * the retry the queue is configured for. One slot of five lost per hung socket
 * is enough to stall delivery entirely.
 *
 * Well inside the queue's own backoff, so a timed-out attempt is retried rather
 * than overlapping the next one.
 */
export const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
export const SMTP_GREETING_TIMEOUT_MS = 10_000;
export const SMTP_SOCKET_TIMEOUT_MS = 20_000;
