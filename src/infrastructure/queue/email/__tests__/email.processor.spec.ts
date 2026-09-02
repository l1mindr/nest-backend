import { EmailMessageType } from '@infrastructure/email/email.message';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { SystemLogEvent } from '@infrastructure/logging/mongodb/mongodb.constants';
import { Job, UnrecoverableError } from 'bullmq';
import { EmailProcessor } from '../email.processor';
import { EmailJob } from '../email.job';

describe('EmailProcessor retry behavior', () => {
  const queuedAt = '2026-07-28T08:00:00.000Z';
  const jobData: EmailJob = {
    queuedAt,
    message: {
      type: EmailMessageType.PRICE_ALERT,
      to: 'owner@example.com',
      data: {
        coinName: 'Bitcoin',
        coinSymbol: 'btc',
        direction: 'SELL',
        targetPrice: '100000',
        currentPrice: '101234.5',
        triggeredAt: '2026-07-28T07:59:00.000Z'
      }
    }
  };

  const emailService = {
    sendPriceAlertEmail: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
  const systemLogService = { error: jest.fn() };

  let processor: EmailProcessor;

  function buildJob(
    attemptsMade: number,
    options: { attempts?: number } = {}
  ): Job<EmailJob> {
    return {
      id: 'job-1',
      attemptsMade,
      opts: { attempts: options.attempts ?? 5 },
      data: jobData
    } as unknown as Job<EmailJob>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    emailService.sendPriceAlertEmail.mockResolvedValue(undefined);
    processor = new EmailProcessor(
      emailService as never,
      logger as never,
      systemLogService as never
    );
  });

  it('should complete a job whose delivery succeeds', async () => {
    await expect(processor.process(buildJob(0))).resolves.toBeUndefined();

    expect(emailService.sendPriceAlertEmail).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: LogEvent.EMAIL_JOB_SENT,
        jobId: 'job-1',
        attempt: 1
      }),
      expect.any(String)
    );
    expect(systemLogService.error).not.toHaveBeenCalled();
  });

  it('should rethrow a transient failure so BullMQ retries it', async () => {
    const error = new Error('socket hang up');
    emailService.sendPriceAlertEmail.mockRejectedValue(error);

    await expect(processor.process(buildJob(0))).rejects.toBe(error);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: LogEvent.EMAIL_JOB_RETRY,
        jobId: 'job-1',
        attempt: 1
      }),
      expect.any(String)
    );
    expect(systemLogService.error).not.toHaveBeenCalled();
  });

  it('should report a rising retry attempt derived from attemptsMade', async () => {
    emailService.sendPriceAlertEmail.mockRejectedValue(new Error('still down'));

    await expect(processor.process(buildJob(1))).rejects.toThrow('still down');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: LogEvent.EMAIL_JOB_RETRY, attempt: 2 }),
      expect.any(String)
    );
  });

  it('should stop retrying once the attempt budget is exhausted', async () => {
    const error = new Error('final failure');
    emailService.sendPriceAlertEmail.mockRejectedValue(error);

    await expect(processor.process(buildJob(4, { attempts: 5 }))).rejects.toBe(
      error
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: LogEvent.EMAIL_JOB_FAILED,
        jobId: 'job-1',
        attempt: 5,
        permanent: false
      }),
      expect.any(String)
    );
    expect(systemLogService.error).toHaveBeenCalledWith(
      SystemLogEvent.QUEUE_JOB_FAILED,
      'Email delivery failed on the final attempt',
      expect.objectContaining({
        metadata: expect.objectContaining({ jobId: 'job-1', attempt: 5 })
      })
    );
  });

  it('should refuse further retries for a permanent rejection', async () => {
    const permanent = Object.assign(new Error('bad mailbox'), {
      responseCode: 550
    });
    emailService.sendPriceAlertEmail.mockRejectedValue(permanent);

    const promise = processor.process(buildJob(0));

    await expect(promise).rejects.toBeInstanceOf(UnrecoverableError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: LogEvent.EMAIL_JOB_FAILED,
        permanent: true
      }),
      expect.any(String)
    );
    expect(systemLogService.error).toHaveBeenCalledWith(
      SystemLogEvent.QUEUE_JOB_FAILED,
      'Email delivery was permanently rejected',
      expect.any(Object)
    );
  });

  it('should discard a malformed payload as unrecoverable', async () => {
    const malformed = {
      id: 'job-x',
      attemptsMade: 0,
      opts: { attempts: 5 },
      data: { queuedAt, message: { type: 'BOGUS' } }
    };

    await expect(processor.process(malformed as never)).rejects.toBeInstanceOf(
      UnrecoverableError
    );
    expect(emailService.sendPriceAlertEmail).not.toHaveBeenCalled();
  });

  it('should not rely on the email side effect alone to deduplicate', async () => {
    // A successful delivery resolves and the same job id published again is
    // treated as the same job by BullMQ's jobId deduplication (see the
    // publisher), so one crossing maps to one delivery.
    await processor.process(buildJob(0));

    expect(emailService.sendPriceAlertEmail).toHaveBeenCalledTimes(1);
  });
});
