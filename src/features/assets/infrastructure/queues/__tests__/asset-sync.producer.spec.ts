import { AssetSyncProducer } from '../asset-sync.producer';

describe('AssetSyncProducer', () => {
  const queue = {
    add: jest.fn()
  };
  const config: any = {
    assetSync: {
      attempts: 4,
      backoffMs: 60_000,
      keepCompleted: 10,
      keepFailed: 50,
      publishTimeoutMs: 2_000
    }
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  let producer: AssetSyncProducer;

  beforeEach(() => {
    jest.clearAllMocks();
    queue.add.mockResolvedValue({ id: 'job-1' });
    producer = new AssetSyncProducer(queue as any, config, logger as any);
  });

  it('should enqueue a manual sync job with deduplication and queue options', async () => {
    const result = await producer.enqueueManualSync();

    expect(queue.add).toHaveBeenCalledWith(
      'sync',
      { trigger: 'manual' },
      {
        deduplication: { id: 'manual-asset-sync' },
        attempts: 4,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 }
      }
    );
    expect(result).toEqual({ jobId: 'job-1' });
  });

  it('should surface the existing job id when a sync is already pending', async () => {
    queue.add.mockResolvedValue({ id: 'existing-job' });

    const result = await producer.enqueueManualSync();

    expect(result).toEqual({ jobId: 'existing-job' });
  });

  it('should reject when publishing exceeds the timeout budget', async () => {
    jest.useFakeTimers();
    queue.add.mockImplementation(() => new Promise(() => undefined));

    const promise = producer.enqueueManualSync();
    const assertion = expect(promise).rejects.toThrow(
      'Publishing to the asset-sync queue timed out after 2000ms'
    );

    jest.advanceTimersByTime(2_001);

    await assertion;
    jest.useRealTimers();
  });
});
