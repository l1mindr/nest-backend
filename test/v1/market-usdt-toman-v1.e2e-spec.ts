import { MarketOverviewErrors } from '@features/market-overview/domain/errors/market-overview-errors';
import { UsdtTomanCacheService } from '@features/market-overview/infrastructure/cache/usdt-toman-cache.service';
import { NobitexUsdtTomanProvider } from '@features/market-overview/infrastructure/nobitex/usdt-toman.provider';
import { WallexUsdtTomanProvider } from '@features/market-overview/infrastructure/wallex/usdt-toman.provider';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

/**
 * The USDT/Toman route end to end.
 *
 * Both exchange adapters are stubbed at the adapter boundary — no test here
 * touches a live venue — but everything above them is real: the failover
 * chain, the shared cache, the use case, the controller and the DTO. That is
 * what makes this worth having next to the unit tests: it proves the price the
 * API serves comes from whichever provider actually answered, rather than from
 * anything hardcoded in the controller.
 */
describe('Market USDT/Toman (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const nobitexRate = {
    priceToman: '234619',
    priceChangePercentage24h: '3.3000',
    updatedAt: new Date('2026-09-09T14:35:00.000Z'),
    provider: 'nobitex'
  };

  const wallexRate = {
    priceToman: '234251',
    priceChangePercentage24h: '2.8800',
    updatedAt: new Date('2026-09-09T14:36:00.000Z'),
    provider: 'wallex'
  };

  /** Empties the shared cache so each test starts from a known state. */
  function resetCache(): void {
    (app.get(UsdtTomanCacheService) as unknown as { entry: unknown }).entry =
      null;
  }

  function stubProviders() {
    return {
      nobitex: jest.spyOn(
        app.get(NobitexUsdtTomanProvider),
        'fetchUsdtTomanRate'
      ),
      wallex: jest.spyOn(app.get(WallexUsdtTomanProvider), 'fetchUsdtTomanRate')
    };
  }

  beforeAll(async () => {
    const context = await createMigratedTestApp();
    app = context.app;
    dataSource = context.dataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
    jest.restoreAllMocks();
    resetCache();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('should require authentication', async () => {
    const client = new ApiClient(app);

    const response = await client.get('/v1/market/usdt-toman');

    expect(response.status).toBe(401);
  });

  it('should serve the preferred exchange rate and cache it', async () => {
    const { client } = await AuthFactory.authenticated(app);
    const { nobitex, wallex } = stubProviders();
    nobitex.mockResolvedValue(nobitexRate);

    const first = await client.get('/v1/market/usdt-toman');
    const second = await client.get('/v1/market/usdt-toman');

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      priceToman: '234619',
      priceChangePercentage24h: '3.3000',
      updatedAt: nobitexRate.updatedAt.toISOString(),
      provider: 'nobitex',
      isStale: false
    });
    expect(new Date(first.body.fetchedAt).getTime()).not.toBeNaN();
    expect(second.body).toEqual(first.body);
    // Cached, and the fallback was never needed.
    expect(nobitex).toHaveBeenCalledTimes(1);
    expect(wallex).not.toHaveBeenCalled();
  });

  it('should serve the fallback exchange when the preferred one fails', async () => {
    const { client } = await AuthFactory.authenticated(app);
    const { nobitex, wallex } = stubProviders();
    nobitex.mockRejectedValue(MarketOverviewErrors.providerUnavailable());
    wallex.mockResolvedValue(wallexRate);

    const response = await client.get('/v1/market/usdt-toman');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      priceToman: '234251',
      provider: 'wallex',
      // A fallback is still a fresh read; only a cached value is stale.
      isStale: false
    });
    expect(wallex).toHaveBeenCalledTimes(1);
  });

  it('should fail with a clear error when every exchange fails and nothing is cached', async () => {
    const { client } = await AuthFactory.authenticated(app);
    const { nobitex, wallex } = stubProviders();
    nobitex.mockRejectedValue(MarketOverviewErrors.providerUnavailable());
    wallex.mockRejectedValue(MarketOverviewErrors.providerTimeout());

    const response = await client.get('/v1/market/usdt-toman');

    expect(response.status).toBe(502);
    // Not one venue's error: the code says the whole chain was exhausted, and
    // the message names both venues so the cause is diagnosable from the
    // response alone.
    expect(response.body).toMatchObject({
      error: {
        code: 'MARKET_OVERVIEW_PROVIDERS_EXHAUSTED',
        message: 'All market data providers failed (nobitex, wallex)'
      }
    });
    expect(nobitex).toHaveBeenCalledTimes(1);
    expect(wallex).toHaveBeenCalledTimes(1);
  });

  it('should serve a stale cached rate, marked as such, once every exchange fails', async () => {
    const { client } = await AuthFactory.authenticated(app);
    const { nobitex, wallex } = stubProviders();

    nobitex.mockResolvedValueOnce(nobitexRate);
    const first = await client.get('/v1/market/usdt-toman');
    expect(first.body.isStale).toBe(false);

    // Force the next request past the cache TTL without waiting on it for
    // real, while keeping the cached value available for the stale fallback.
    (
      app.get(UsdtTomanCacheService) as unknown as {
        entry: { expiresAt: number };
      }
    ).entry.expiresAt = 0;

    nobitex.mockRejectedValue(MarketOverviewErrors.providerUnavailable());
    wallex.mockRejectedValue(MarketOverviewErrors.providerUnavailable());

    const second = await client.get('/v1/market/usdt-toman');

    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
      priceToman: '234619',
      provider: 'nobitex',
      isStale: true
    });
    // The old value keeps its original fetch time rather than looking fresh.
    expect(second.body.fetchedAt).toBe(first.body.fetchedAt);
  });
});
