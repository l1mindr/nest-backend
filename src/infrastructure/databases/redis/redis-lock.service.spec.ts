import { RedisLockKey } from './keys/redis-lock-key.enum';
import { RedisLockService } from './redis-lock.service';
import { RedisService } from './redis.service';

describe('RedisLockService', () => {
  let service: RedisLockService;

  const mockRedisService = {
    setWithExpiry: jest.fn(),
    del: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new RedisLockService(mockRedisService as unknown as RedisService);
  });

  describe('acquire', () => {
    it('should acquire lock successfully', async () => {
      mockRedisService.setWithExpiry.mockResolvedValue('OK');

      const result = await service.acquire(
        RedisLockKey.REFRESH_LOCK,
        'session-id',
        5
      );

      expect(result).toBe(true);

      expect(mockRedisService.setWithExpiry).toHaveBeenCalledWith(
        'refresh:lock:session-id',
        '1',
        5
      );
    });

    it('should return false when lock already exists', async () => {
      mockRedisService.setWithExpiry.mockResolvedValue(null);

      const result = await service.acquire(
        RedisLockKey.REFRESH_LOCK,
        'session-id'
      );

      expect(result).toBe(false);

      expect(mockRedisService.setWithExpiry).toHaveBeenCalledWith(
        'refresh:lock:session-id',
        '1',
        5
      );
    });
  });

  describe('release', () => {
    it('should release lock successfully', async () => {
      mockRedisService.del.mockResolvedValue(1);

      await service.release(RedisLockKey.REFRESH_LOCK, 'session-id');

      expect(mockRedisService.del).toHaveBeenCalledWith(
        'refresh:lock:session-id'
      );
    });
  });
});
