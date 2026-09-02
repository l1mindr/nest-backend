import { Injectable } from '@nestjs/common';
import { EmailMessage } from './email.message';

export interface EmailPublishOptions {
  /**
   * Collapses repeat publications of the same message into one delivery.
   *
   * Two calls carrying the same key are treated as the same email for as long
   * as the queue still remembers the first one, which makes a retried use case
   * — a client resubmitting a registration, say — safe to run twice. It must be
   * derived from values that identify the *occasion* rather than the content:
   * never from a verification code or an invitation token, both of which would
   * then be readable in Redis keys and log lines.
   *
   * Deduplication is best effort. Completed jobs are eventually trimmed, and a
   * key becomes free again once its job is gone.
   */
  dedupeKey?: string;

  /**
   * Reports a failure to enqueue to the caller instead of swallowing it.
   *
   * The default silence is right for the flows described below, which have all
   * committed their state before publishing and are answering an HTTP request.
   * It is wrong for a caller that has *not* committed yet and whose record of
   * having notified someone would otherwise be a lie — the price-alert
   * scheduler, which leaves an alert active and retries next cycle rather than
   * marking it triggered for an email nobody will receive.
   *
   * Only the failure to enqueue is raised. Delivery happens later, and its
   * failures belong to the queue's retries.
   */
  throwOnQueueFailure?: boolean;
}

/**
 * How the application asks for an email to be sent.
 *
 * Callers say what to deliver and to whom; when and how many times the provider
 * is actually dialled is the queue's business. Nothing about this port names a
 * transport or a job, so use cases stay free of both.
 *
 * `publish` resolves once the message is durably accepted for delivery — not
 * once it is delivered. Delivery is asynchronous and at-least-once.
 *
 * By default it never rejects. Every request-path flow that sends email here has
 * already committed the database state the email describes, so a queue outage
 * must not turn a successful registration or suspension into a failed HTTP
 * request. Failures to enqueue are logged as `email.job.queue_failed` and the
 * email is dropped — unless the caller asks for them with
 * {@link EmailPublishOptions.throwOnQueueFailure}.
 */
@Injectable()
export abstract class EmailPublisher {
  abstract publish(
    message: EmailMessage,
    options?: EmailPublishOptions
  ): Promise<void>;
}
