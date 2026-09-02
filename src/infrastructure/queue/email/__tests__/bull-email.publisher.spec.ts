import { EmailMessageType } from '@infrastructure/email/email.message';
import { BullEmailPublisher } from '../bull-email.publisher';

describe('BullEmailPublisher', () => {
  const queuedAt = new Date('2026-07-28T08:00:00.000Z');
  const message = {
    type: EmailMessageType.PRICE_ALERT as const,
    to: 'owner@example.com',
    data: {
      coinName: 'Bitcoin',
      coinSymbol: 'btc',
      direction: 'SELL' as const,
      targetPrice: '100000',
      currentPrice: '101234.5',
      triggeredAt: '2026-07-28T07:59:00.000Z'
    }
  };
  const queue = { add: jest.fn() };
  const config = {
    email: {
      attempts: 5,
      backoffMs: 5_000,
      keepCompleted: 100,
      keepFailed: 1_000,
      publishTimeoutMs: 2_000
    }
  };
  const clockService = { nowDate: jest.fn() };
  const logger = { setContext: jest.fn(), info: jest.fn(), error: jest.fn() };

  let publisher: BullEmailPublisher;

  beforeEach(() => {
    jest.clearAllMocks();
    clockService.nowDate.mockReturnValue(queuedAt);
    queue.add.mockResolvedValue({ id: 'job-id' });
    publisher = new BullEmailPublisher(
      queue as never,
      config as never,
      clockService as never,
      logger as never
    );
  });

  it('should enqueue the message under the caller deduplication key', async () => {
    await publisher.publish(message, { dedupeKey: 'price-alert.alert-id.t0' });

    const [, job, options] = queue.add.mock.calls[0];

    expect(job.message).toEqual(message);
    expect(options.jobId).toBe('price-alert.alert-id.t0');
    expect(options.attempts).toBe(5);
  });

  it('should configure exponential backoff for transient failures', async () => {
    await publisher.publish(message, { dedupeKey: 'price-alert.alert-id.t0' });

    const [, , options] = queue.add.mock.calls[0];

    expect(options.backoff).toEqual({
      type: 'exponential',
      delay: 5_000
    });
    expect(options.attempts).toBe(config.email.attempts);
  });

  it('should swallow an enqueue failure for request-path callers', async () => {
    queue.add.mockRejectedValue(new Error('redis unavailable'));

    await expect(publisher.publish(message)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should report an enqueue failure to a caller that asked for it', async () => {
    queue.add.mockRejectedValue(new Error('redis unavailable'));

    await expect(
      publisher.publish(message, { throwOnQueueFailure: true })
    ).rejects.toThrow('redis unavailable');
    expect(logger.error).toHaveBeenCalled();
  });
});
