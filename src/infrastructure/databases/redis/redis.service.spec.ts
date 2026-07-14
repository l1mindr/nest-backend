import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  const mockRedis = {
    set: jest.fn(),
    setIfNotExists: jest.fn(),
    setIfNotExistsWithExpiry: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    eval: jest.fn(),
    quit: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new RedisService(mockRedis as any);
  });

  describe('set', () => {
    it('should set value', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.set('test:key', 'value');

      expect(result).toBe('OK');
      expect(mockRedis.set).toHaveBeenCalledWith('test:key', 'value');
    });
  });

  describe('setIfNotExists', () => {
    it('should return true when key is set', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.setIfNotExists('test:key', 'value');

      expect(result).toBe('OK');
      expect(mockRedis.set).toHaveBeenCalledWith('test:key', 'value', 'NX');
    });

    it('should return false when key already exists', async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await service.setIfNotExists('test:key', 'value');

      expect(result).toBe(null);
    });
  });

  describe('setIfNotExistsWithExpiry', () => {
    it('should return true when key is set with expiry', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.setIfNotExistsWithExpiry('lock:key', '1', 5);

      expect(result).toBe('OK');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:key',
        '1',
        'EX',
        5,
        'NX'
      );
    });

    it('should return false when key already exists', async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await service.setIfNotExistsWithExpiry('lock:key', '1', 5);

      expect(result).toBe(null);
    });
  });

  describe('setWithExpiry', () => {
    it('should set value with expiry', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.setWithExpiry('lock:key', '1', 5);

      expect(result).toBe('OK');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:key',
        '1',
        'EX',
        5,
        'NX'
      );
    });

    it('should return null when key already exists', async () => {
      mockRedis.set.mockResolvedValue(null);

      const result = await service.setWithExpiry('lock:key', '1', 5);

      expect(result).toBeNull();
    });
  });

  describe('get', () => {
    it('should get value', async () => {
      mockRedis.get.mockResolvedValue('value');

      const result = await service.get('test:key');

      expect(result).toBe('value');
      expect(mockRedis.get).toHaveBeenCalledWith('test:key');
    });
  });

  describe('del', () => {
    it('should delete key', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await service.del('test:key');

      expect(result).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledWith('test:key');
    });
  });

  describe('compareAndDelete', () => {
    it('should run the Lua script with the key and expected value', async () => {
      mockRedis.eval.mockResolvedValue(1);

      const result = await service.compareAndDelete('lock:key', 'token');

      expect(result).toBe(1);

      const [script, numKeys, key, value] = mockRedis.eval.mock.calls[0];
      expect(typeof script).toBe('string');
      expect(script).toContain('redis.call("del", KEYS[1])');
      expect(numKeys).toBe(1);
      expect(key).toBe('lock:key');
      expect(value).toBe('token');
    });

    it('should return 0 when the stored value does not match', async () => {
      mockRedis.eval.mockResolvedValue(0);

      const result = await service.compareAndDelete('lock:key', 'stale-token');

      expect(result).toBe(0);
    });
  });

  describe('onModuleDestroy', () => {
    it('should close redis connection', async () => {
      await service.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalledTimes(1);
    });
  });
});
