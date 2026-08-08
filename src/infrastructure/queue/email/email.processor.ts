import {
  EmailMessage,
  EmailMessageType
} from '@infrastructure/email/email.message';
import { EmailService } from '@infrastructure/email/email.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { EMAIL_QUEUE, EMAIL_WORKER_CONCURRENCY } from '../queue.constants';
import { isPermanentDeliveryFailure } from './email-delivery-error.classifier';
import { MalformedEmailJobError, parseEmailJob } from './email-job.validator';
import { EmailJob } from './email.job';

/**
 * Delivers queued email.
 *
 * This is the only place in the project that calls the email provider. It does
 * the queue's half of the work — validating the payload, deciding whether a
 * failure is worth another attempt, reporting the outcome — and leaves
 * rendering and SMTP to {@link EmailService}.
 *
 * Processing is at-least-once. A worker that dies after the provider accepted a
 * message but before the job was marked complete will send that message again
 * when the job is reclaimed, so every message it handles has to be one a
 * recipient can receive twice without harm. All four are: each names a code,
 * token or account event that is already true.
 */
@Processor(EMAIL_QUEUE, { concurrency: EMAIL_WORKER_CONCURRENCY })
export class EmailProcessor extends WorkerHost {
  constructor(
    private readonly emailService: EmailService,
    private readonly logger: PinoLogger
  ) {
    super();
    this.logger.setContext(EmailProcessor.name);
  }

  async process(job: Job<EmailJob>): Promise<void> {
    const { message, queuedAt } = this.parse(job);

    this.logger.info(
      {
        event: LogEvent.EMAIL_JOB_STARTED,
        jobId: job.id,
        messageType: message.type,
        to: message.to,
        attempt: this.attemptNumber(job),
        waitedMs: Date.now() - Date.parse(queuedAt)
      },
      'Email delivery started'
    );

    try {
      await this.deliver(message);
    } catch (error: unknown) {
      throw this.reportFailure(job, message, error);
    }

    this.logger.info(
      {
        event: LogEvent.EMAIL_JOB_SENT,
        jobId: job.id,
        messageType: message.type,
        to: message.to,
        attempt: this.attemptNumber(job)
      },
      'Email delivered'
    );
  }

  private parse(job: Job<EmailJob>): EmailJob {
    try {
      return parseEmailJob(job.data);
    } catch (error: unknown) {
      if (!(error instanceof MalformedEmailJobError)) throw error;

      this.logger.error(
        {
          event: LogEvent.EMAIL_JOB_FAILED,
          jobId: job.id,
          reason: error.message
        },
        'Email job payload is malformed and was discarded'
      );

      // Nothing about a bad payload improves with time.
      throw new UnrecoverableError(error.message);
    }
  }

  /**
   * Turns the delivery failure into the error BullMQ needs, having logged which
   * of the two outcomes it is.
   */
  private reportFailure(
    job: Job<EmailJob>,
    message: EmailMessage,
    error: unknown
  ): Error {
    const permanent = isPermanentDeliveryFailure(error);
    const attempt = this.attemptNumber(job);
    const willRetry = !permanent && attempt < (job.opts.attempts ?? 1);

    const context = {
      jobId: job.id,
      messageType: message.type,
      to: message.to,
      attempt,
      err: error
    };

    if (willRetry) {
      this.logger.warn(
        { ...context, event: LogEvent.EMAIL_JOB_RETRY },
        'Email delivery failed and will be retried'
      );

      return error instanceof Error ? error : new Error(String(error));
    }

    this.logger.error(
      { ...context, event: LogEvent.EMAIL_JOB_FAILED, permanent },
      permanent
        ? 'Email delivery was permanently rejected and will not be retried'
        : 'Email delivery failed on the final attempt'
    );

    if (!permanent) {
      return error instanceof Error ? error : new Error(String(error));
    }

    // Stops BullMQ short of the remaining attempts rather than spending them on
    // an answer the server has already given.
    return new UnrecoverableError(
      error instanceof Error ? error.message : String(error)
    );
  }

  /**
   * BullMQ counts an attempt only once it has finished, so during processing
   * `attemptsMade` is the number of attempts *before* this one.
   */
  private attemptNumber(job: Job<EmailJob>): number {
    return job.attemptsMade + 1;
  }

  private deliver(message: EmailMessage): Promise<void> {
    switch (message.type) {
      case EmailMessageType.VERIFICATION:
        return this.emailService.sendVerificationEmail(
          message.to,
          message.data.code,
          message.data.expiresInMinutes
        );

      case EmailMessageType.ADMIN_INVITATION:
        return this.emailService.sendAdminInvitationEmail(
          message.to,
          message.data.token,
          message.data.expiresInHours
        );

      case EmailMessageType.SUSPENSION:
        return this.emailService.sendSuspensionEmail(
          message.to,
          message.data.displayName,
          message.data.reason,
          new Date(message.data.suspendedAt)
        );

      case EmailMessageType.UNSUSPENSION:
        return this.emailService.sendUnsuspensionEmail(
          message.to,
          message.data.displayName,
          new Date(message.data.unsuspendedAt)
        );
    }
  }
}
