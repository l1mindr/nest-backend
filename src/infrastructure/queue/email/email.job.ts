import { EmailMessage } from '@infrastructure/email/email.message';

/**
 * What one entry on the email queue carries.
 *
 * Everything here is JSON, because a job is written to Redis and read back by a
 * different process — possibly a different deployment of this codebase, after a
 * rolling restart. The message is the whole instruction; `queuedAt` exists so
 * the worker can report how long a delivery waited, which is the number that
 * tells you whether the queue is keeping up.
 */
export interface EmailJob {
  message: EmailMessage;
  /** ISO 8601, stamped when the job was accepted for delivery. */
  queuedAt: string;
}
