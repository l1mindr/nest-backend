import {
  GLOBAL_MARKET_DATA_PORT,
  GlobalMarketDataPort
} from '@features/market-overview/application/interfaces/market-overview.interface';
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
      updatedAt: snapshot.updatedAt.toISOString()
    });
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
