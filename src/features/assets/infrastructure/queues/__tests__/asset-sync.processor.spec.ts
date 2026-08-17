import { AssetSyncProcessor } from '../asset-sync.processor';

describe('AssetSyncProcessor', () => {
  const syncUseCase = {
    execute: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  };

  let processor: AssetSyncProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new AssetSyncProcessor(
      syncUseCase as any,
      logger as any,
      { error: jest.fn(), warn: jest.fn(), info: jest.fn() } as any
    );
  });

  it('should invoke the sync use case for a job', async () => {
    syncUseCase.execute.mockResolvedValue({
      receivedCount: 10,
      synchronizedCount: 9
    });

    await processor.process({ id: 'job-1', attemptsMade: 0, data: {} } as any);

    expect(syncUseCase.execute).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'assets.sync.completed',
        jobId: 'job-1',
        attempt: 1,
        receivedCount: 10,
        synchronizedCount: 9
      }),
      expect.any(String)
    );
  });

  it('should log and rethrow when the sync fails', async () => {
    const error = new Error('provider down');
    syncUseCase.execute.mockRejectedValue(error);

    const promise = processor.process({
      id: 'job-2',
      attemptsMade: 1,
      data: {}
    } as any);

    await expect(promise).rejects.toBe(error);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'assets.sync.failed',
        jobId: 'job-2',
        attempt: 2
      }),
      expect.any(String)
    );
  });
});
