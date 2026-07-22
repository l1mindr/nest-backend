import { RedisCounterService } from './redis-counter.service';
import { RedisService } from './redis.service';

describe('RedisCounterService', () => {
  let service: RedisCounterService;

  const mockRedisService = {
    eval: jest.fn(),
    get: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new RedisCounterService(
      mockRedisService as unknown as RedisService
    );
  });

  describe('get', () => {
    it('should return the value from redis', async () => {
      mockRedisService.get.mockResolvedValue('3');

      const result = await service.get('rate:limit:/v1/auth/login:127.0.0.1');

      expect(result).toBe('3');
      expect(mockRedisService.get).toHaveBeenCalledWith(
        'rate:limit:/v1/auth/login:127.0.0.1'
      );
    });
  });

  describe('increment', () => {
    it('should call eval with the Lua script, key, and ttl', async () => {
      mockRedisService.eval.mockResolvedValue(1);

      const result = await service.increment(
        'rate:limit:/v1/auth/login:127.0.0.1',
        60
      );

      expect(result).toBe(1);

      const [script, keys, ttl] = mockRedisService.eval.mock.calls[0];
      expect(typeof script).toBe('string');
      expect(script).toContain('redis.call("incr", KEYS[1])');
      expect(script).toContain('redis.call("expire", KEYS[1]');
      expect(keys).toEqual(['rate:limit:/v1/auth/login:127.0.0.1']);
      expect(ttl).toBe(60);
    });

    it('should pass empty string for ttl when not provided', async () => {
      mockRedisService.eval.mockResolvedValue(1);

      const result = await service.increment('counter:key');

      expect(result).toBe(1);

      const [, keys, ttl] = mockRedisService.eval.mock.calls[0];
      expect(keys).toEqual(['counter:key']);
      expect(ttl).toBe('');
    });

    it('should return the current counter value on subsequent increments', async () => {
      mockRedisService.eval.mockResolvedValue(5);

      const result = await service.increment(
        'rate:limit:/v1/auth/login:127.0.0.1',
        60
      );

      expect(result).toBe(5);
    });

    it('should coerce the eval result to a number', async () => {
      mockRedisService.eval.mockResolvedValue('3');

      const result = await service.increment('counter:key', 30);

      expect(result).toBe(3);
      expect(typeof result).toBe('number');
    });

    it('should propagate redis errors', async () => {
      const error = new Error('ECONNRESET');
      mockRedisService.eval.mockRejectedValue(error);

      await expect(service.increment('counter:key', 60)).rejects.toThrow(
        'ECONNRESET'
      );
    });
  });
});
