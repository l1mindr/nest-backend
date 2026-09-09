/**
 * Retry, backoff, and how a failed delivery is classified.
 *
 * These are the queue's response to what a mail server says, so the spec
 * controls the server rather than the client: `SmtpStubServer` answers each
 * submission with a reply code chosen here, and everything else — the
 * publisher, BullMQ, `EmailProcessor`, `SmtpEmailService`, the transport built
 * by the application's own factory — is production code doing its real job over
 * a real socket.
 *
 * The three outcomes it has to tell apart:
 *
 *   4xx, then success   the queue waited and tried again, and the email landed
 *   5xx                 no second attempt; further ones cannot succeed
 *   4xx to the last try failed, but as a transient failure, not a rejection
 *
 * Deliberately not driven by breaking something real. A refused port, a stopped
 * container and a dropped packet each produce a different error at a different
 * layer, none of them on demand, and a spec built on one fails for reasons
 * unconnected to the code it covers.
 */

import { EmailMessageType } from '@infrastructure/email/email.message';
import { EmailPublisher } from '@infrastructure/email/email.publisher';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { INestApplication } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import {
  createMigratedTestApp,
  releaseSmtpTransport
} from '../bootstrap/test-app';
import {
  EmailProcessorObserver,
  ProcessedAttempt,
  emailQueue,
  observeEmailProcessor
} from '../helpers/email-queue.helper';
import {
  LogCapture,
  captureApplicationLogs,
  logContext
} from '../helpers/log-capture.helper';
import { uniqueRecipient } from '../helpers/mailpit.helper';
import { clearRedis } from '../helpers/redis.helper';
import { SmtpStubServer } from '../helpers/smtp-stub.server';

/**
 * Queue settings for this file, applied before the application reads its
 * configuration and restored afterwards — Jest reuses a worker process across
 * spec files, so `process.env` is shared state.
 *
 * Three attempts is the smallest number that shows backoff growing, and 500ms
 * is long enough to measure without making the file slow: the two waits come to
 * 1.5 seconds.
 */
const QUEUE_ENV = {
  EMAIL_QUEUE_ATTEMPTS: '3',
  EMAIL_QUEUE_BACKOFF_MS: '500',
  // Both retentions are 0 under `.env.test`, which would delete the very job
  // these assertions are about.
  EMAIL_QUEUE_KEEP_COMPLETED: '50',
  EMAIL_QUEUE_KEEP_FAILED: '50'
} as const;

const ATTEMPTS = Number(QUEUE_ENV.EMAIL_QUEUE_ATTEMPTS);
const BACKOFF_MS = Number(QUEUE_ENV.EMAIL_QUEUE_BACKOFF_MS);

/**
 * Timers are allowed to fire a hair early, and an assertion that BullMQ waited
 * *at least* the configured delay should not fail over a millisecond of it.
 */
const TIMING_TOLERANCE = 0.9;

const TRANSIENT_REPLY = '451 4.7.1 Service temporarily unavailable, try later';
const PERMANENT_REPLY = '550 5.1.1 Recipient address rejected';
const ACCEPTED_REPLY = '250 2.0.0 Ok: queued';

const restoreEnv = new Map<string, string | undefined>();

Object.entries(QUEUE_ENV).forEach(([key, value]) => {
  restoreEnv.set(key, process.env[key]);
  process.env[key] = value;
});

describe('Email retry and backoff (e2e)', () => {
  let app: INestApplication;
  let stub: SmtpStubServer;
  let processor: EmailProcessorObserver;
  let logs: LogCapture;

  beforeAll(async () => {
    stub = await SmtpStubServer.start({ replies: [ACCEPTED_REPLY] });

    processor = observeEmailProcessor();
    logs = captureApplicationLogs();

    const context = await createMigratedTestApp({
      email: 'delivered',
      smtpTransport: stub.transport()
    });

    app = context.app;
  });

  afterAll(async () => {
    if (app) releaseSmtpTransport(app);

    await app?.close();
    await stub?.stop();

    processor?.stop();
    logs?.stop();

    restoreEnv.forEach((value, key) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  });

  beforeEach(async () => {
    await clearRedis(app);
  });

  /** Publishes one email through the real publisher and returns the address. */
  const publish = async (): Promise<string> => {
    const to = uniqueRecipient('retry');

    await app.get(EmailPublisher).publish({
      type: EmailMessageType.VERIFICATION,
      to,
      data: { code: '424242', expiresInMinutes: 3 }
    });

    return to;
  };

  /** Milliseconds between the start of each attempt and the one before it. */
  const gapsBetween = (attempts: ProcessedAttempt[]): number[] =>
    attempts
      .slice(1)
      .map((attempt, index) => attempt.startedAt - attempts[index].startedAt);

  const failureLogFor = (to: string): Record<string, unknown> | undefined =>
    logs
      .calls()
      .map(logContext)
      .find(
        (context) =>
          context?.event === LogEvent.EMAIL_JOB_FAILED && context.to === to
      ) ?? undefined;

  const stateOf = async (jobId: string): Promise<string> => {
    const job = await emailQueue(app).getJob(jobId);

    if (!job) throw new Error(`Job ${jobId} is no longer on the queue.`);

    return job.getState();
  };

  it('retries a transient failure, waits longer each time, and delivers', async () => {
    stub.script([TRANSIENT_REPLY, TRANSIENT_REPLY, ACCEPTED_REPLY]);

    const to = await publish();
    const attempts = await processor.waitForAttempts(to, ATTEMPTS);

    expect(attempts.map(({ attempt }) => attempt)).toEqual([1, 2, 3]);

    // The first two were refused and the third was accepted, which is the
    // server's account of the same three attempts.
    expect(stub.submissions).toBe(3);

    const [firstOutcome, secondOutcome, finalOutcome] = await Promise.all(
      attempts.map(({ outcome }) => outcome)
    );

    expect(firstOutcome?.message).toContain('451');
    expect(secondOutcome?.message).toContain('451');
    expect(finalOutcome).toBeNull();

    // Exponential from the configured base: roughly 500ms, then 1000ms.
    const [firstGap, secondGap] = gapsBetween(attempts);

    expect(firstGap).toBeGreaterThanOrEqual(BACKOFF_MS * TIMING_TOLERANCE);
    expect(secondGap).toBeGreaterThanOrEqual(BACKOFF_MS * 2 * TIMING_TOLERANCE);
    expect(secondGap).toBeGreaterThan(firstGap);

    // The queue agrees: the job is done, having taken three tries to get there.
    const jobId = attempts[0].job.id as string;

    await expect(stateOf(jobId)).resolves.toBe('completed');
    expect(failureLogFor(to)).toBeUndefined();
  });

  it('does not retry a permanent rejection', async () => {
    stub.script([PERMANENT_REPLY]);

    const to = await publish();
    const [attempt] = await processor.waitForAttempts(to, 1);

    const error = await attempt.outcome;

    // `UnrecoverableError` is how the processor tells BullMQ to stop, and is
    // therefore the classification itself rather than a proxy for it.
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(error?.message).toContain('550');

    // Long enough for the 500ms backoff to have elapsed twice over: if a retry
    // were coming, it would have arrived.
    await delay(BACKOFF_MS * 3);

    expect(processor.attemptsFor(to)).toHaveLength(1);
    expect(stub.submissions).toBe(1);

    await expect(stateOf(attempt.job.id as string)).resolves.toBe('failed');

    expect(failureLogFor(to)).toMatchObject({
      permanent: true,
      messageType: EmailMessageType.VERIFICATION
    });
  });

  it('spends every attempt on a transient failure and reports it as transient', async () => {
    stub.script([TRANSIENT_REPLY]);

    const to = await publish();
    const attempts = await processor.waitForAttempts(to, ATTEMPTS);

    expect(attempts).toHaveLength(ATTEMPTS);
    expect(stub.submissions).toBe(ATTEMPTS);

    const outcomes = await Promise.all(attempts.map(({ outcome }) => outcome));

    expect(outcomes.every((outcome) => outcome !== null)).toBe(true);

    // Exhausting the attempts is not the same as being rejected, and the
    // difference is what an operator reads to decide whether the address is
    // wrong or the server was down.
    const finalError = outcomes[outcomes.length - 1];

    expect(finalError).toBeInstanceOf(Error);
    expect(finalError).not.toBeInstanceOf(UnrecoverableError);

    await expect(stateOf(attempts[0].job.id as string)).resolves.toBe('failed');

    expect(failureLogFor(to)).toMatchObject({
      permanent: false,
      attempt: ATTEMPTS
    });
  });
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
