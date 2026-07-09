import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  const mockRedis = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    quit: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new RedisService(mockRedis as any);
  });

  it('should set value', async () => {
    mockRedis.set.mockResolvedValue('OK');

    await service.set('test:key', 'value');

    expect(mockRedis.set).toHaveBeenCalledWith('test:key', 'value');
  });

  it('should set value with expiry', async () => {
    mockRedis.set.mockResolvedValue('OK');

    await service.setWithExpiry('lock:key', '1', 5);

    expect(mockRedis.set).toHaveBeenCalledWith('lock:key', '1', 'EX', 5);
  });

  it('should get value', async () => {
    mockRedis.get.mockResolvedValue('value');

    const result = await service.get('test:key');

    expect(result).toBe('value');

    expect(mockRedis.get).toHaveBeenCalledWith('test:key');
  });

  it('should delete key', async () => {
    mockRedis.del.mockResolvedValue(1);

    await service.del('test:key');

    expect(mockRedis.del).toHaveBeenCalledWith('test:key');
  });

  it('should close redis connection', async () => {
    await service.onModuleDestroy();

    expect(mockRedis.quit).toHaveBeenCalled();
  });
});
