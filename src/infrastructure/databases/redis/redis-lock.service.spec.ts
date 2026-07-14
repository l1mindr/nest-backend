import { RedisKey } from './keys/redis-key.enum';
import { RedisLockService } from './redis-lock.service';
import { RedisService } from './redis.service';

describe('RedisLockService', () => {
  let service: RedisLockService;

  const mockRedisService = {
    setIfNotExistsWithExpiry: jest.fn(),
    compareAndDelete: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new RedisLockService(mockRedisService as unknown as RedisService);
  });

  describe('acquire', () => {
    it('should acquire the lock and return a unique token stored as the value', async () => {
      mockRedisService.setIfNotExistsWithExpiry.mockResolvedValue('OK');

      const token = await service.acquire(
        RedisKey.REFRESH_LOCK,
        'session-id',
        5
      );

      expect(typeof token).toBe('string');
      expect(token).not.toHaveLength(0);

      const [key, storedValue, ttl] =
        mockRedisService.setIfNotExistsWithExpiry.mock.calls[0];

      expect(key).toBe('refresh:lock:session-id');
      expect(storedValue).toBe(token);
      expect(ttl).toBe(5);
    });

    it('should generate a distinct token per acquisition', async () => {
      mockRedisService.setIfNotExistsWithExpiry.mockResolvedValue('OK');

      const first = await service.acquire(RedisKey.REFRESH_LOCK, 'session-id');
      const second = await service.acquire(RedisKey.REFRESH_LOCK, 'session-id');

      expect(first).not.toBe(second);
    });

    it('should return null when the lock is already held', async () => {
      mockRedisService.setIfNotExistsWithExpiry.mockResolvedValue(null);

      const token = await service.acquire(RedisKey.REFRESH_LOCK, 'session-id');

      expect(token).toBeNull();
      expect(mockRedisService.setIfNotExistsWithExpiry).toHaveBeenCalledWith(
        'refresh:lock:session-id',
        expect.any(String),
        5
      );
    });
  });

  describe('release', () => {
    it('should release the lock when the token matches', async () => {
      mockRedisService.compareAndDelete.mockResolvedValue(1);

      const released = await service.release(
        RedisKey.REFRESH_LOCK,
        'session-id',
        'my-token'
      );

      expect(released).toBe(true);
      expect(mockRedisService.compareAndDelete).toHaveBeenCalledWith(
        'refresh:lock:session-id',
        'my-token'
      );
    });

    it('should not release the lock when the token does not match', async () => {
      mockRedisService.compareAndDelete.mockResolvedValue(0);

      const released = await service.release(
        RedisKey.REFRESH_LOCK,
        'session-id',
        'stale-token'
      );

      expect(released).toBe(false);
    });
  });
});
