import {
  GLOBAL_MARKET_DATA_PORT,
  GlobalMarketDataPort
} from '@features/market-overview/application/interfaces/market-overview.interface';
import { MarketOverviewCacheService } from '@features/market-overview/infrastructure/cache/market-overview-cache.service';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

describe('Market Overview (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const snapshot = {
    totalMarketCapUsd: '2412345678901.23',
    marketCapChangePercentage24h: '1.24',
    btcDominancePercentage: '51.32',
    updatedAt: new Date('2026-08-02T14:35:00.000Z')
  };

  beforeAll(async () => {
    const context = await createMigratedTestApp();
    app = context.app;
    dataSource = context.dataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('should require authentication', async () => {
    const client = new ApiClient(app);

    const response = await client.get('/v1/market/overview');

    expect(response.status).toBe(401);
  });

  it('should return the global market snapshot and serve it from cache on the next request', async () => {
    const { client } = await AuthFactory.authenticated(app);
    const provider = app.get<GlobalMarketDataPort>(GLOBAL_MARKET_DATA_PORT);
    const spy = jest
      .spyOn(provider, 'fetchGlobalMarketData')
      .mockResolvedValue(snapshot);

    const first = await client.get('/v1/market/overview');
    const second = await client.get('/v1/market/overview');

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      totalMarketCapUsd: '2412345678901.23',
      marketCapChangePercentage24h: '1.24',
      btcDominancePercentage: '51.32',
      updatedAt: snapshot.updatedAt.toISOString(),
      isStale: false
    });
    expect(new Date(first.body.fetchedAt).getTime()).not.toBeNaN();
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should serve a stale cached snapshot, marked as such, when the provider fails after a successful fetch', async () => {
    const { client } = await AuthFactory.authenticated(app);
    const provider = app.get<GlobalMarketDataPort>(GLOBAL_MARKET_DATA_PORT);
    const spy = jest.spyOn(provider, 'fetchGlobalMarketData');
    spy.mockClear();
    // The cache is per-replica, in-memory state that outlives a single test
    // (it is a singleton, not reset by `truncateDatabase`/`clearRedis`), so
    // it is reset directly to start from a known, empty state.
    const cache = app.get(MarketOverviewCacheService);
    (cache as unknown as { entry: unknown }).entry = null;

    spy.mockResolvedValueOnce(snapshot);
    const first = await client.get('/v1/market/overview');
    expect(first.status).toBe(200);
    expect(first.body.isStale).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);

    // Force the next request past the cache TTL without waiting on it for
    // real, while keeping the cached value available for the stale-fallback
    // path.
    (cache as unknown as { entry: { expiresAt: number } }).entry!.expiresAt = 0;

    spy.mockRejectedValueOnce(new Error('provider unavailable'));
    const second = await client.get('/v1/market/overview');

    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
      totalMarketCapUsd: snapshot.totalMarketCapUsd,
      isStale: true
    });
    expect(second.body.fetchedAt).toBe(first.body.fetchedAt);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
