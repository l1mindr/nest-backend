/**
 * Watches the BullMQ side of email delivery.
 *
 * A message sitting in Mailpit proves that SMTP happened; it does not by itself
 * prove *what* dialled SMTP. `EmailProcessor` is the only thing in the project
 * that is allowed to, so a spec that means "the queue delivered this" has to
 * say so about the processor. Spying on its `process` is the direct form of
 * that claim: the job it was handed carries the recipient and the message type,
 * and the promise it returned is that attempt's outcome — which is also how
 * retries and backoff become observable, since every attempt arrives here.
 *
 * `jest.spyOn` keeps the real implementation. This observes the pipeline; it
 * does not stand in for any part of it.
 */

import { EmailMessageType } from '@infrastructure/email/email.message';
import { EmailJob } from '@infrastructure/queue/email/email.job';
import { EmailProcessor } from '@infrastructure/queue/email/email.processor';
import { EMAIL_QUEUE } from '@infrastructure/queue/queue.constants';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

const DEFAULT_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 50;

/** One attempt the processor made, and how it ended. */
export interface ProcessedAttempt {
  job: Job<EmailJob>;
  /** 1 for the first try. See the note where it is recorded. */
  attempt: number;
  /** When `process` was entered — the measurement backoff is read from. */
  startedAt: number;
  /** Resolves to the error the attempt threw, or null if it succeeded. */
  outcome: Promise<Error | null>;
}

export interface AttemptQuery {
  /** Narrows to one flow, for a recipient that receives more than one email. */
  type?: EmailMessageType;
  timeoutMs?: number;
}

export interface EmailProcessorObserver {
  /** Every matching attempt seen so far, in the order they were made. */
  attemptsFor(recipient: string, type?: EmailMessageType): ProcessedAttempt[];

  /**
   * Waits until `count` matching attempts have been made and every one of them
   * has settled.
   */
  waitForAttempts(
    recipient: string,
    count: number,
    query?: AttemptQuery
  ): Promise<ProcessedAttempt[]>;

  /**
   * Waits for one successful delivery and returns the job that carried it.
   * Fails if the attempt it finds ended in an error.
   */
  waitForDelivery(
    recipient: string,
    query?: AttemptQuery
  ): Promise<Job<EmailJob>>;

  stop(): void;
}

/**
 * Starts observing. Call before the application is created and `stop()` in an
 * `afterAll`.
 */
export function observeEmailProcessor(): EmailProcessorObserver {
  const attempts: ProcessedAttempt[] = [];

  // Taken before the spy replaces it, so the wrapper delegates to the real
  // implementation rather than to itself.
  const deliver = EmailProcessor.prototype.process;

  const spy = jest
    .spyOn(EmailProcessor.prototype, 'process')
    .mockImplementation(function (
      this: EmailProcessor,
      job: Job<EmailJob>
    ): Promise<void> {
      const result = deliver.call(this, job);

      attempts.push({
        job,
        // Recorded on entry: BullMQ counts an attempt only once it has
        // finished, so `attemptsMade` here is the number of attempts before
        // this one.
        attempt: job.attemptsMade + 1,
        startedAt: Date.now(),
        outcome: result.then(
          () => null,
          (error: unknown) =>
            error instanceof Error ? error : new Error(String(error))
        )
      });

      return result;
    });

  const attemptsFor = (
    recipient: string,
    type?: EmailMessageType
  ): ProcessedAttempt[] =>
    attempts.filter(
      ({ job }) =>
        job.data?.message?.to === recipient &&
        (type === undefined || job.data.message.type === type)
    );

  const waitForAttempts = async (
    recipient: string,
    count: number,
    query: AttemptQuery = {}
  ): Promise<ProcessedAttempt[]> => {
    const { type, timeoutMs = DEFAULT_TIMEOUT_MS } = query;
    const deadline = Date.now() + timeoutMs;

    while (
      attemptsFor(recipient, type).length < count &&
      Date.now() < deadline
    ) {
      await delay(POLL_INTERVAL_MS);
    }

    const found = attemptsFor(recipient, type);

    if (found.length < count) {
      throw new Error(
        `Expected ${count} delivery attempt(s) for ${recipient}${
          type ? ` of type ${type}` : ''
        } within ${timeoutMs}ms, saw ${found.length}.`
      );
    }

    await Promise.all(found.map(({ outcome }) => outcome));

    return found;
  };

  return {
    attemptsFor,
    waitForAttempts,

    waitForDelivery: async (recipient, query = {}) => {
      const [attempt] = await waitForAttempts(recipient, 1, query);
      const error = await attempt.outcome;

      if (error) {
        throw new Error(
          `The email processor failed to deliver to ${recipient}: ${error.message}`
        );
      }

      return attempt.job;
    },

    stop: () => spy.mockRestore()
  };
}

export function emailQueue(app: INestApplication): Queue<EmailJob> {
  return app.get<Queue<EmailJob>>(getQueueToken(EMAIL_QUEUE));
}

/** The message type on a job, for asserting which flow produced it. */
export function messageTypeOf(job: Job<EmailJob>): EmailMessageType {
  return job.data.message.type;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
