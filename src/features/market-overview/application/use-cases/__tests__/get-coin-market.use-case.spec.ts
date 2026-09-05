import { GetCoinMarketUseCase } from '../get-coin-market.use-case';

describe('GetCoinMarketUseCase', () => {
  const provider = {
    fetchCoinMarketData: jest.fn()
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
    priceUsd: '112345.67',
    priceChangePercentage24h: '1.24',
    updatedAt: new Date('2026-08-02T14:35:00.000Z')
  };
  const fetchedAt = new Date('2026-08-02T14:35:20.000Z');

  let useCase: GetCoinMarketUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetCoinMarketUseCase(
      provider as any,
      cache as any,
      logger as any
    );
  });

  it('should return the cached value without calling the provider, marked fresh', async () => {
    cache.get.mockReturnValue({ value: entry, fetchedAt });

    const result = await useCase.execute('bitcoin');

    expect(result).toEqual({ ...entry, fetchedAt, isStale: false });
    expect(provider.fetchCoinMarketData).not.toHaveBeenCalled();
  });

  it('should fetch from the provider on a cache miss, populate the cache, and mark fresh', async () => {
    cache.get.mockReturnValue(null);
    provider.fetchCoinMarketData.mockResolvedValue(entry);
    cache.set.mockReturnValue({ value: entry, fetchedAt });

    const result = await useCase.execute('bitcoin');

    expect(result).toMatchObject({ ...entry, isStale: false });
    // The fresh response must carry the very `fetchedAt` the cache
    // stored, so it agrees with what later cached reads report.
    expect(result.fetchedAt).toBe(fetchedAt);
    expect(cache.set).toHaveBeenCalledWith('bitcoin', entry);
  });

  it('should serve a stale cached value when the provider fails, marked stale', async () => {
    cache.get.mockReturnValue(null);
    cache.getStale.mockReturnValue({ value: entry, fetchedAt });
    provider.fetchCoinMarketData.mockRejectedValue(new Error('boom'));

    const result = await useCase.execute('bitcoin');

    expect(result).toEqual({ ...entry, fetchedAt, isStale: true });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should rethrow when the provider fails and there is no cached value', async () => {
    cache.get.mockReturnValue(null);
    cache.getStale.mockReturnValue(null);
    const error = new Error('boom');
    provider.fetchCoinMarketData.mockRejectedValue(error);

    await expect(useCase.execute('bitcoin')).rejects.toBe(error);
  });
});
