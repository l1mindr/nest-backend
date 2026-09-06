import { GetMarketOverviewUseCase } from '../get-market-overview.use-case';

describe('GetMarketOverviewUseCase', () => {
  const provider = {
    fetchGlobalMarketData: jest.fn()
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
    totalMarketCapUsd: '2412345678901.23',
    marketCapChangePercentage24h: '1.24',
    btcDominancePercentage: '51.32',
    ethDominancePercentage: '17.84',
    updatedAt: new Date('2026-08-02T14:35:00.000Z')
  };
  const fetchedAt = new Date('2026-08-02T14:36:12.000Z');

  let useCase: GetMarketOverviewUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetMarketOverviewUseCase(
      provider as any,
      cache as any,
      logger as any
    );
  });

  it('should return the cached value without calling the provider, marked fresh', async () => {
    cache.get.mockReturnValue({ value: entry, fetchedAt });

    const result = await useCase.execute();

    expect(result).toEqual({ ...entry, fetchedAt, isStale: false });
    expect(provider.fetchGlobalMarketData).not.toHaveBeenCalled();
  });

  it('should fetch from the provider on a cache miss, populate the cache, and mark fresh', async () => {
    cache.get.mockReturnValue(null);
    cache.set.mockReturnValue({ value: entry, fetchedAt });
    provider.fetchGlobalMarketData.mockResolvedValue(entry);

    const result = await useCase.execute();

    expect(result).toEqual({ ...entry, fetchedAt, isStale: false });
    expect(cache.set).toHaveBeenCalledWith(entry);
  });

  it('should serve a stale cached value when the provider fails, marked stale', async () => {
    cache.get.mockReturnValue(null);
    cache.getStale.mockReturnValue({ value: entry, fetchedAt });
    provider.fetchGlobalMarketData.mockRejectedValue(new Error('boom'));

    const result = await useCase.execute();

    expect(result).toEqual({ ...entry, fetchedAt, isStale: true });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should rethrow when the provider fails and there is no cached value', async () => {
    cache.get.mockReturnValue(null);
    cache.getStale.mockReturnValue(null);
    const error = new Error('boom');
    provider.fetchGlobalMarketData.mockRejectedValue(error);

    await expect(useCase.execute()).rejects.toBe(error);
  });
});
