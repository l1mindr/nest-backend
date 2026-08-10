import { Asset } from '@features/assets/domain/entities/asset.entity';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

describe('Portfolio opening balance (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

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

  function mutationHeaders(ctx: AuthenticatedUserContext) {
    return {
      'X-CSRF-Token': ctx.response.headers.xCsrfToken
    };
  }

  async function seedAsset(currentPrice: string | null = '150') {
    return dataSource.getRepository(Asset).save({
      coinGeckoId: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      imageUrl: null,
      currentPrice,
      marketCap: '1200000000000',
      marketCapRank: 1,
      totalVolume: '30000000000',
      circulatingSupply: '19000000',
      totalSupply: '21000000',
      maxSupply: '21000000',
      priceChange24h: '5',
      priceChangePercentage24h: '0.8',
      lastSyncedAt: new Date('2026-08-01T08:00:00.000Z')
    });
  }

  async function createPortfolio(auth: AuthenticatedUserContext) {
    const response = await auth.client.post('/v1/portfolios', {
      body: { name: 'Imported Ledger', sourceType: 'WALLET' },
      headers: mutationHeaders(auth)
    });

    expect(response.status).toBe(201);

    return response.body as { id: string };
  }

  async function setOpeningBalance(
    auth: AuthenticatedUserContext,
    portfolioId: string,
    assetId: string,
    openingQuantity: string,
    openingCost: string
  ) {
    return auth.client.put(
      `/v1/portfolios/${portfolioId}/opening-balances/${assetId}`,
      {
        body: { openingQuantity, openingCost },
        headers: mutationHeaders(auth)
      }
    );
  }

  async function createTransaction(
    auth: AuthenticatedUserContext,
    portfolioId: string,
    assetId: string,
    body: Record<string, unknown>
  ) {
    return auth.client.post(`/v1/portfolios/${portfolioId}/transactions`, {
      body: { assetId, ...body },
      headers: mutationHeaders(auth)
    });
  }

  it('should require authentication', async () => {
    const client = new ApiClient(app);

    const response = await client.get(
      '/v1/portfolios/00000000-0000-4000-8000-000000000000/opening-balances'
    );

    expect(response.status).toBe(401);
  });

  it('should persist, list and replace an exact opening balance', async () => {
    const auth = await AuthFactory.authenticated(app);
    const portfolio = await createPortfolio(auth);
    const asset = await seedAsset();

    const created = await setOpeningBalance(
      auth,
      portfolio.id,
      asset.id,
      '1.5',
      '90000.12345678901234567890123456'
    );

    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({
      portfolioId: portfolio.id,
      assetId: asset.id,
      openingQuantity: '1.500000000000000000',
      openingCost: '90000.12345678901234567890123456',
      asset: { id: asset.id, symbol: 'btc' }
    });

    const updated = await setOpeningBalance(
      auth,
      portfolio.id,
      asset.id,
      '2',
      '100000'
    );

    expect(updated.status).toBe(200);
    expect(updated.body.id).toBe(created.body.id);
    expect(updated.body).toMatchObject({
      openingQuantity: '2.000000000000000000',
      openingCost: '100000.00000000000000000000000000'
    });

    const list = await auth.client.get(
      `/v1/portfolios/${portfolio.id}/opening-balances`
    );

    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].id).toBe(created.body.id);
  });

  it('should reject a foreign portfolio before writing an opening balance', async () => {
    const userA = await AuthFactory.authenticated(app, {
      overrides: { email: 'ownerA@test.com', username: 'ownerA' }
    });
    const userB = await AuthFactory.authenticated(app, {
      overrides: { email: 'ownerB@test.com', username: 'ownerB' }
    });
    const portfolio = await createPortfolio(userA);
    const asset = await seedAsset();

    const response = await setOpeningBalance(
      userB,
      portfolio.id,
      asset.id,
      '1',
      '100'
    );

    expect(response.status).toBe(404);
  });

  it('should reject malformed opening decimals', async () => {
    const auth = await AuthFactory.authenticated(app);
    const portfolio = await createPortfolio(auth);
    const asset = await seedAsset();

    const response = await setOpeningBalance(
      auth,
      portfolio.id,
      asset.id,
      '0.1',
      '0.123456789012345678901234567'
    );

    expect(response.status).toBe(422);
  });

  it('should calculate an opening-only position with exact decimals', async () => {
    const auth = await AuthFactory.authenticated(app);
    const portfolio = await createPortfolio(auth);
    const asset = await seedAsset('0.3');

    const opening = await setOpeningBalance(
      auth,
      portfolio.id,
      asset.id,
      '0.1',
      '0.02'
    );
    expect(opening.status).toBe(200);

    const pnl = await auth.client.get(`/v1/portfolios/${portfolio.id}/pnl`);

    expect(pnl.status).toBe(200);
    expect(pnl.body).toMatchObject({
      totalCurrentValue: '0.03',
      totalCostBasis: '0.02',
      totalUnrealizedPnl: '0.01',
      totalPnl: '0.01',
      positions: [
        {
          assetId: asset.id,
          quantity: '0.100000000000000000',
          totalCost: '0.02000000000000000000000000',
          averageCost: '0.2',
          currentValue: '0.03',
          unrealizedPnl: '0.01'
        }
      ]
    });
  });

  it.each([
    {
      strategy: 'AVERAGE',
      releasedCostBasis: '150',
      remainingCost: '150',
      realizedPnl: '0'
    },
    {
      strategy: 'FIFO',
      releasedCostBasis: '100',
      remainingCost: '200',
      realizedPnl: '50'
    },
    {
      strategy: 'LIFO',
      releasedCostBasis: '200',
      remainingCost: '100',
      realizedPnl: '-50'
    }
  ])(
    'should apply opening balance with $strategy cost basis',
    async ({ strategy, releasedCostBasis, remainingCost, realizedPnl }) => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const asset = await seedAsset('150');

      const opening = await setOpeningBalance(
        auth,
        portfolio.id,
        asset.id,
        '1',
        '100'
      );
      expect(opening.status).toBe(200);

      const buy = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '1',
        price: '200',
        occurredAt: '2026-08-01T08:00:00.000Z'
      });
      expect(buy.status).toBe(201);

      const sell = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'SELL',
        amount: '1',
        price: '150',
        occurredAt: '2026-08-02T08:00:00.000Z'
      });
      expect(sell.status).toBe(201);

      const pnl = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/pnl?costBasis=${strategy}`
      );

      expect(pnl.status).toBe(200);
      expect(pnl.body.positions[0]).toMatchObject({
        quantity: '1',
        totalCost: remainingCost,
        realizedPnl,
        realizedPnlEvents: [
          {
            transactionId: sell.body.id,
            releasedCostBasis,
            realizedPnl
          }
        ]
      });
    }
  );
});
