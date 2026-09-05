import {
  FEAR_GREED_PORT,
  FearGreedPort
} from '@features/market-sentiment/application/interfaces/market-sentiment.interface';
import { FearGreedCacheService } from '@features/market-sentiment/infrastructure/cache/fear-greed-cache.service';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

describe('Market Sentiment (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const snapshot = {
    value: 74,
    classification: 'Greed',
    updatedAt: new Date('2026-08-02T14:35:00.000Z'),
    nextUpdateAt: new Date('2026-08-03T00:00:00.000Z')
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

    const response = await client.get('/v1/market/fear-greed');

    expect(response.status).toBe(401);
  });

  it('should return the fear & greed snapshot and serve it from cache on the next request', async () => {
    const { client } = await AuthFactory.authenticated(app);
    const provider = app.get<FearGreedPort>(FEAR_GREED_PORT);
    const spy = jest
      .spyOn(provider, 'fetchFearGreedIndex')
      .mockResolvedValue(snapshot);

    const first = await client.get('/v1/market/fear-greed');
    const second = await client.get('/v1/market/fear-greed');

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      value: 74,
      classification: 'Greed',
      updatedAt: snapshot.updatedAt.toISOString(),
      nextUpdateAt: snapshot.nextUpdateAt.toISOString(),
      isStale: false
    });
    expect(new Date(first.body.fetchedAt).getTime()).not.toBeNaN();
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should serve a stale cached snapshot, marked as such, when the provider fails after a successful fetch', async () => {
    const { client } = await AuthFactory.authenticated(app);
    const provider = app.get<FearGreedPort>(FEAR_GREED_PORT);
    const spy = jest.spyOn(provider, 'fetchFearGreedIndex');
    spy.mockClear();
    // The cache is per-replica, in-memory state that outlives a single test
    // (it is a singleton, not reset by `truncateDatabase`/`clearRedis`), so
    // it is reset directly to start from a known, empty state.
    const cache = app.get(FearGreedCacheService);
    (cache as unknown as { entry: unknown }).entry = null;

    spy.mockResolvedValueOnce(snapshot);
    const first = await client.get('/v1/market/fear-greed');
    expect(first.status).toBe(200);
    expect(first.body.isStale).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);

    // Force the next request past the cache TTL without waiting on it for
    // real, while keeping the cached value available for the stale-fallback
    // path.
    (cache as unknown as { entry: { expiresAt: number } }).entry!.expiresAt = 0;

    spy.mockRejectedValueOnce(new Error('provider unavailable'));
    const second = await client.get('/v1/market/fear-greed');

    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
      value: snapshot.value,
      isStale: true
    });
    expect(second.body.fetchedAt).toBe(first.body.fetchedAt);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
