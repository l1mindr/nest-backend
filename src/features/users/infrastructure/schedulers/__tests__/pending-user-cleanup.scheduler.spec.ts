import { PendingUserCleanupScheduler } from '../pending-user-cleanup.scheduler';

describe('PendingUserCleanupScheduler', () => {
  const cleanupUseCase = {
    execute: jest.fn()
  };

  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCleanup', () => {
    it('should trigger the cleanup use case', async () => {
      const scheduler = new PendingUserCleanupScheduler(
        cleanupUseCase as any,
        logger as any
      );

      await scheduler.handleCleanup();

      expect(cleanupUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('should log failures without throwing', async () => {
      cleanupUseCase.execute.mockRejectedValue(new Error('db failure'));
      const scheduler = new PendingUserCleanupScheduler(
        cleanupUseCase as any,
        logger as any
      );

      await scheduler.handleCleanup();

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
