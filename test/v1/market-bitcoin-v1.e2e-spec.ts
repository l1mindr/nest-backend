import {
  BITCOIN_MARKET_PORT,
  BitcoinMarketPort
} from '@features/market-overview/application/interfaces/bitcoin-market.interface';
import { BitcoinCacheService } from '@features/market-overview/infrastructure/cache/bitcoin-cache.service';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

describe('Market Bitcoin (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const snapshot = {
    priceUsd: '112345.67',
    priceChangePercentage24h: '1.24',
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

    const response = await client.get('/v1/market/bitcoin');

    expect(response.status).toBe(401);
  });

  it('should return the bitcoin ticker and serve it from cache on the next request', async () => {
    const { client } = await AuthFactory.authenticated(app);
    const provider = app.get<BitcoinMarketPort>(BITCOIN_MARKET_PORT);
    const spy = jest
      .spyOn(provider, 'fetchBitcoinMarketData')
      .mockResolvedValue(snapshot);

    const first = await client.get('/v1/market/bitcoin');
    const second = await client.get('/v1/market/bitcoin');

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      priceUsd: '112345.67',
      priceChangePercentage24h: '1.24',
      updatedAt: snapshot.updatedAt.toISOString(),
      isStale: false
    });
    expect(new Date(first.body.fetchedAt).getTime()).not.toBeNaN();
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should serve a stale cached ticker, marked as such, when the provider fails after a successful fetch', async () => {
    const { client } = await AuthFactory.authenticated(app);
    const provider = app.get<BitcoinMarketPort>(BITCOIN_MARKET_PORT);
    const spy = jest.spyOn(provider, 'fetchBitcoinMarketData');
    spy.mockClear();
    const cache = app.get(BitcoinCacheService);
    (cache as unknown as { entry: unknown }).entry = null;

    spy.mockResolvedValueOnce(snapshot);
    const first = await client.get('/v1/market/bitcoin');
    expect(first.status).toBe(200);
    expect(first.body.isStale).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);

    (cache as unknown as { entry: { expiresAt: number } }).entry!.expiresAt = 0;

    spy.mockRejectedValueOnce(new Error('provider unavailable'));
    const second = await client.get('/v1/market/bitcoin');

    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
      priceUsd: snapshot.priceUsd,
      isStale: true
    });
    expect(second.body.fetchedAt).toBe(first.body.fetchedAt);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
