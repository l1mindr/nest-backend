import { MarketOverviewErrors } from '../../../domain/errors/market-overview-errors';
import { UsdtTomanCacheService } from '../../../infrastructure/cache/usdt-toman-cache.service';
import {
  UsdtTomanEntry,
  UsdtTomanPort
} from '../../interfaces/usdt-toman.interface';
import { GetUsdtTomanUseCase } from '../get-usdt-toman.use-case';

const FETCHED_AT = new Date('2026-09-09T12:00:00.000Z');

const RATE: UsdtTomanEntry = {
  priceToman: '234619',
  priceChangePercentage24h: '3.3000',
  updatedAt: FETCHED_AT,
  provider: 'nobitex'
};

describe('GetUsdtTomanUseCase', () => {
  const provider = { name: 'failover', fetchUsdtTomanRate: jest.fn() };
  const cache = { get: jest.fn(), getStale: jest.fn(), set: jest.fn() };
  const logger = { setContext: jest.fn(), warn: jest.fn() };

  let useCase: GetUsdtTomanUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetUsdtTomanUseCase(
      provider as unknown as UsdtTomanPort,
      cache as unknown as UsdtTomanCacheService,
      logger as never
    );
  });

  it('fetches and caches on a cache miss', async () => {
    cache.get.mockReturnValue(null);
    provider.fetchUsdtTomanRate.mockResolvedValue(RATE);
    cache.set.mockReturnValue({ value: RATE, fetchedAt: FETCHED_AT });

    const result = await useCase.execute();

    expect(result).toMatchObject({
      priceToman: '234619',
      provider: 'nobitex',
      fetchedAt: FETCHED_AT,
      isStale: false
    });
    expect(cache.set).toHaveBeenCalledWith(RATE);
  });

  it('serves a fresh cached rate without calling the provider', async () => {
    cache.get.mockReturnValue({ value: RATE, fetchedAt: FETCHED_AT });

    const result = await useCase.execute();

    expect(result).toMatchObject({
      priceToman: '234619',
      fetchedAt: FETCHED_AT,
      isStale: false
    });
    expect(provider.fetchUsdtTomanRate).not.toHaveBeenCalled();
  });

  it('carries the answering venue through the cache', async () => {
    cache.get.mockReturnValue(null);
    cache.set.mockReturnValue({
      value: { ...RATE, provider: 'wallex' },
      fetchedAt: FETCHED_AT
    });
    provider.fetchUsdtTomanRate.mockResolvedValue({
      ...RATE,
      provider: 'wallex'
    });

    await expect(useCase.execute()).resolves.toMatchObject({
      provider: 'wallex'
    });
  });

  describe('when every provider fails', () => {
    beforeEach(() => {
      cache.get.mockReturnValue(null);
      provider.fetchUsdtTomanRate.mockRejectedValue(
        MarketOverviewErrors.providersExhausted(['nobitex', 'wallex'])
      );
    });

    it('does not overwrite the cached value', async () => {
      cache.getStale.mockReturnValue({ value: RATE, fetchedAt: FETCHED_AT });

      await useCase.execute();

      expect(cache.set).not.toHaveBeenCalled();
    });

    // The failed request must not be able to pass an old price off as new.
    it('marks a served cached value stale and keeps its original fetch time', async () => {
      cache.getStale.mockReturnValue({ value: RATE, fetchedAt: FETCHED_AT });

      const result = await useCase.execute();

      expect(result).toMatchObject({
        priceToman: '234619',
        fetchedAt: FETCHED_AT,
        isStale: true
      });
    });

    it('rethrows when there is no cached value at all', async () => {
      cache.getStale.mockReturnValue(null);

      await expect(useCase.execute()).rejects.toThrow(
        expect.objectContaining({
          message: 'All market data providers failed (nobitex, wallex)'
        })
      );
    });
  });
});
