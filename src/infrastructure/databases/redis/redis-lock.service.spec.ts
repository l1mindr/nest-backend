import { RedisKey } from './keys/redis-key.enum';
import { RedisLockService } from './redis-lock.service';
import { RedisService } from './redis.service';

describe('RedisLockService', () => {
  let service: RedisLockService;

  const mockRedisService = {
    setIfNotExistsWithExpiry: jest.fn(),
    del: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new RedisLockService(mockRedisService as unknown as RedisService);
  });

  describe('acquire', () => {
    it('should acquire lock successfully', async () => {
      mockRedisService.setIfNotExistsWithExpiry.mockResolvedValue('OK');

      const result = await service.acquire(
        RedisKey.REFRESH_LOCK,
        'session-id',
        5
      );

      expect(result).toBe(true);

      expect(mockRedisService.setIfNotExistsWithExpiry).toHaveBeenCalledWith(
        'refresh:lock:session-id',
        '1',
        5
      );
    });

    it('should return false when lock already exists', async () => {
      mockRedisService.setIfNotExistsWithExpiry.mockResolvedValue(null);

      const result = await service.acquire(RedisKey.REFRESH_LOCK, 'session-id');

      expect(result).toBe(false);
      expect(mockRedisService.setIfNotExistsWithExpiry).toHaveBeenCalledWith(
        'refresh:lock:session-id',
        '1',
        5
      );
    });
  });

  describe('release', () => {
    it('should release lock successfully', async () => {
      mockRedisService.del.mockResolvedValue(1);

      await service.release(RedisKey.REFRESH_LOCK, 'session-id');

      expect(mockRedisService.del).toHaveBeenCalledWith(
        'refresh:lock:session-id'
      );
    });
  });
});
