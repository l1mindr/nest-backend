import { GetFearGreedUseCase } from '../get-fear-greed.use-case';

describe('GetFearGreedUseCase', () => {
  const provider = {
    fetchFearGreedIndex: jest.fn()
  };
  const cache = {
    get: jest.fn(),
    getStale: jest.fn(),
    set: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    warn: jest.fn()
  };

  const entry = {
    value: 74,
    classification: 'Greed',
    updatedAt: new Date('2026-08-02T14:35:00.000Z'),
    nextUpdateAt: new Date('2026-08-03T00:00:00.000Z')
  };

  let useCase: GetFearGreedUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetFearGreedUseCase(
      provider as any,
      cache as any,
      logger as any
    );
  });

  it('should return the cached value without calling the provider', async () => {
    cache.get.mockReturnValue(entry);

    const result = await useCase.execute();

    expect(result).toBe(entry);
    expect(provider.fetchFearGreedIndex).not.toHaveBeenCalled();
  });

  it('should fetch from the provider on a cache miss and populate the cache', async () => {
    cache.get.mockReturnValue(null);
    provider.fetchFearGreedIndex.mockResolvedValue(entry);

    const result = await useCase.execute();

    expect(result).toBe(entry);
    expect(cache.set).toHaveBeenCalledWith(entry);
  });

  it('should serve a stale cached value when the provider fails', async () => {
    cache.get.mockReturnValue(null);
    cache.getStale.mockReturnValue(entry);
    provider.fetchFearGreedIndex.mockRejectedValue(new Error('boom'));

    const result = await useCase.execute();

    expect(result).toBe(entry);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should rethrow when the provider fails and there is no cached value', async () => {
    cache.get.mockReturnValue(null);
    cache.getStale.mockReturnValue(null);
    const error = new Error('boom');
    provider.fetchFearGreedIndex.mockRejectedValue(error);

    await expect(useCase.execute()).rejects.toBe(error);
  });
});
