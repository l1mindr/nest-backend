import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { CoinSyncScheduler } from '../coin-sync.scheduler';
import { PriceCheckScheduler } from '../price-check.scheduler';

describe('Coin Tracker schedulers', () => {
  const lockService = {
    acquire: jest.fn(),
    release: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    lockService.acquire.mockResolvedValue('lock-token');
    lockService.release.mockResolvedValue(true);
  });

  describe('CoinSyncScheduler', () => {
    const syncUseCase = {
      execute: jest.fn()
    };

    it('should execute and release the distributed lock', async () => {
      const scheduler = new CoinSyncScheduler(
        syncUseCase as any,
        lockService as any,
        logger as any
      );

      await scheduler.handleSync();

      expect(syncUseCase.execute).toHaveBeenCalledTimes(1);
      expect(lockService.release).toHaveBeenCalledWith(
        RedisKey.COIN_SYNC_LOCK,
        'daily',
        'lock-token'
      );
    });
  });

  describe('PriceCheckScheduler', () => {
    const priceCheckService = {
      check: jest.fn()
    };

    it('should skip execution when another instance owns the lock', async () => {
      lockService.acquire.mockResolvedValue(null);
      const scheduler = new PriceCheckScheduler(
        priceCheckService as any,
        lockService as any,
        logger as any
      );

      await scheduler.handleCheck();

      expect(priceCheckService.check).not.toHaveBeenCalled();
      expect(lockService.release).not.toHaveBeenCalled();
    });

    it('should log failures and still release the lock', async () => {
      priceCheckService.check.mockRejectedValue(new Error('failed'));
      const scheduler = new PriceCheckScheduler(
        priceCheckService as any,
        lockService as any,
        logger as any
      );

      await scheduler.handleCheck();

      expect(logger.error).toHaveBeenCalled();
      expect(lockService.release).toHaveBeenCalledWith(
        RedisKey.PRICE_CHECK_LOCK,
        'minute',
        'lock-token'
      );
    });
  });
});
