/**
 * The single email queue. Every email the project sends passes through it, so
 * that retry, backoff and rate of delivery are configured in one place rather
 * than per flow.
 */
export const EMAIL_QUEUE = 'email';

/** The only job name the email queue carries. */
export const SEND_EMAIL_JOB = 'send-email';

/**
 * Concurrent deliveries per worker process.
 *
 * Held as a constant rather than an environment variable because BullMQ reads
 * it from the `@Processor` decorator, which is evaluated before configuration
 * exists. Five matches the SMTP pool in `email.constants.ts`; raising one
 * without the other only queues work inside nodemailer instead.
 */
export const EMAIL_WORKER_CONCURRENCY = 5;
