import { Asset } from '@features/assets/domain/entities/asset.entity';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

describe('Portfolio (e2e) version: 1', () => {
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

  async function seedAsset(
    overrides: Partial<
      Pick<Asset, 'coinGeckoId' | 'symbol' | 'name' | 'currentPrice'>
    > = {}
  ): Promise<Asset> {
    const now = new Date('2026-07-28T08:00:00.000Z');

    return dataSource.getRepository(Asset).save({
      coinGeckoId: overrides.coinGeckoId ?? 'bitcoin',
      symbol: overrides.symbol ?? 'btc',
      name: overrides.name ?? 'Bitcoin',
      imageUrl: null,
      currentPrice:
        overrides.currentPrice !== undefined ? overrides.currentPrice : '60000',
      marketCap: '1200000000000',
      marketCapRank: 1,
      totalVolume: '30000000000',
      circulatingSupply: '19000000',
      totalSupply: '21000000',
      maxSupply: '21000000',
      priceChange24h: '500',
      priceChangePercentage24h: '0.8',
      lastSyncedAt: now
    });
  }

  async function createPortfolio(
    auth: AuthenticatedUserContext,
    body: Record<string, unknown> = {
      name: 'My Ledger',
      sourceType: 'WALLET'
    }
  ) {
    const response = await auth.client.post('/v1/portfolios', {
      body,
      headers: mutationHeaders(auth)
    });

    expect(response.status).toBe(201);

    return response.body as { id: string };
  }

  async function createHolding(
    auth: AuthenticatedUserContext,
    portfolioId: string,
    assetId: string,
    amount = '1.5'
  ) {
    const response = await auth.client.post('/v1/holdings', {
      body: { portfolioId, assetId, amount },
      headers: mutationHeaders(auth)
    });

    expect(response.status).toBe(201);

    return response.body as { id: string };
  }

  describe('Portfolios', () => {
    it('should require authentication', async () => {
      const client = new ApiClient(app);

      const response = await client.post('/v1/portfolios', {
        body: { name: 'My Ledger', sourceType: 'WALLET' }
      });

      expect(response.status).toBe(401);
    });

    it('should require authentication for list', async () => {
      const client = new ApiClient(app);

      const response = await client.get('/v1/portfolios');

      expect(response.status).toBe(401);
    });

    it('should create a portfolio source', async () => {
      const auth = await AuthFactory.authenticated(app);

      const response = await auth.client.post('/v1/portfolios', {
        body: {
          name: '  My Ledger  ',
          sourceType: 'WALLET',
          walletAddress: '0x1234...'
        },
        headers: mutationHeaders(auth)
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'My Ledger',
        sourceType: 'WALLET',
        walletAddress: '0x1234...'
      });
      expect(response.body.id).toEqual(expect.any(String));
      expect(response.body.createdAt).toEqual(expect.any(String));
      expect(response.body.updatedAt).toEqual(expect.any(String));
    });

    it('should list only the authenticated user portfolios', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerA@test.com', username: 'ownerA' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerB@test.com', username: 'ownerB' }
      });

      await createPortfolio(userA, {
        name: 'A Ledger',
        sourceType: 'WALLET'
      });
      await createPortfolio(userB, {
        name: 'B Ledger',
        sourceType: 'WALLET'
      });

      const listA = await userA.client.get('/v1/portfolios');
      expect(listA.status).toBe(200);
      expect(listA.body).toHaveLength(1);
      expect(listA.body[0]).toMatchObject({ name: 'A Ledger' });

      const listB = await userB.client.get('/v1/portfolios');
      expect(listB.status).toBe(200);
      expect(listB.body).toHaveLength(1);
      expect(listB.body[0]).toMatchObject({ name: 'B Ledger' });
    });

    it('should return portfolio by ID', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await auth.client.get(`/v1/portfolios/${portfolio.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: portfolio.id,
        name: 'My Ledger'
      });
    });

    it('should return 404 for another users portfolio', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerA@test.com', username: 'ownerA' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerB@test.com', username: 'ownerB' }
      });

      const portfolio = await createPortfolio(userA);

      const response = await userB.client.get(`/v1/portfolios/${portfolio.id}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for unknown portfolio', async () => {
      const auth = await AuthFactory.authenticated(app);

      const response = await auth.client.get(
        '/v1/portfolios/00000000-0000-4000-8000-000000000000'
      );

      expect(response.status).toBe(404);
    });
  });

  describe('Holdings', () => {
    let asset: Asset;

    beforeEach(async () => {
      asset = await seedAsset();
    });

    it('should require authentication', async () => {
      const client = new ApiClient(app);

      const postResponse = await client.post('/v1/holdings', {
        body: {
          portfolioId: '00000000-0000-4000-8000-000000000000',
          assetId: asset.id,
          amount: '1.5'
        }
      });

      expect(postResponse.status).toBe(401);

      const getResponse = await client.get('/v1/holdings');

      expect(getResponse.status).toBe(401);
    });

    it('should add a holding to a portfolio', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await auth.client.post('/v1/holdings', {
        body: {
          portfolioId: portfolio.id,
          assetId: asset.id,
          amount: '1.5',
          notes: 'Cold storage'
        },
        headers: mutationHeaders(auth)
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        portfolioId: portfolio.id,
        assetId: asset.id,
        notes: 'Cold storage',
        asset: { id: asset.id, symbol: 'btc', name: 'Bitcoin' }
      });
      expect(response.body.id).toEqual(expect.any(String));
      expect(Number(response.body.amount)).toBe(1.5);
      expect(response.body.createdAt).toEqual(expect.any(String));
      expect(response.body.updatedAt).toEqual(expect.any(String));
    });

    it('should reject invalid asset UUID', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await auth.client.post('/v1/holdings', {
        body: {
          portfolioId: portfolio.id,
          assetId: 'not-a-uuid',
          amount: '1.5'
        },
        headers: mutationHeaders(auth)
      });

      expect(response.status).toBe(422);
    });

    it('should reject non-existent asset', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await auth.client.post('/v1/holdings', {
        body: {
          portfolioId: portfolio.id,
          assetId: '00000000-0000-4000-8000-000000000000',
          amount: '1.5'
        },
        headers: mutationHeaders(auth)
      });

      expect(response.status).toBe(404);
    });

    it('should reject duplicate holding', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      await createHolding(auth, portfolio.id, asset.id, '1.5');

      const response = await auth.client.post('/v1/holdings', {
        body: {
          portfolioId: portfolio.id,
          assetId: asset.id,
          amount: '1.5'
        },
        headers: mutationHeaders(auth)
      });

      expect(response.status).toBe(422);
    });

    it('should list holdings', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      await createHolding(auth, portfolio.id, asset.id, '1.5');

      const response = await auth.client.get('/v1/holdings');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0]).toMatchObject({
        portfolioId: portfolio.id,
        assetId: asset.id
      });
      expect(response.body.nextCursor).toBeNull();
    });

    it('should list holdings filtered by portfolio', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolioA = await createPortfolio(auth, {
        name: 'Portfolio A',
        sourceType: 'WALLET'
      });
      const portfolioB = await createPortfolio(auth, {
        name: 'Portfolio B',
        sourceType: 'EXCHANGE'
      });

      await createHolding(auth, portfolioA.id, asset.id, '1.5');

      const response = await auth.client.get('/v1/holdings', {
        query: { portfolioId: portfolioA.id }
      });

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].portfolioId).toBe(portfolioA.id);

      const responseB = await auth.client.get('/v1/holdings', {
        query: { portfolioId: portfolioB.id }
      });

      expect(responseB.status).toBe(200);
      expect(responseB.body.items).toHaveLength(0);
    });

    it('should update holding amount and notes', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const holding = await createHolding(auth, portfolio.id, asset.id, '1.5');

      const response = await auth.client.patch(`/v1/holdings/${holding.id}`, {
        body: { amount: '2.5', notes: 'Updated' },
        headers: mutationHeaders(auth)
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: holding.id,
        notes: 'Updated'
      });
      expect(Number(response.body.amount)).toBe(2.5);
    });

    it('should reject empty update', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const holding = await createHolding(auth, portfolio.id, asset.id, '1.5');

      const response = await auth.client.patch(`/v1/holdings/${holding.id}`, {
        body: {},
        headers: mutationHeaders(auth)
      });

      expect(response.status).toBe(422);
    });

    it('should remove a holding', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const holding = await createHolding(auth, portfolio.id, asset.id, '1.5');

      const response = await auth.client.delete(`/v1/holdings/${holding.id}`, {
        headers: mutationHeaders(auth)
      });

      expect(response.status).toBe(204);

      const list = await auth.client.get('/v1/holdings');
      expect(list.body.items).toHaveLength(0);
    });

    it('should deny cross-user portfolio access for holdings creation', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerA@test.com', username: 'ownerA' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerB@test.com', username: 'ownerB' }
      });

      const portfolio = await createPortfolio(userA);

      const response = await userB.client.post('/v1/holdings', {
        body: {
          portfolioId: portfolio.id,
          assetId: asset.id,
          amount: '1.5'
        },
        headers: mutationHeaders(userB)
      });

      expect(response.status).toBe(404);
    });

    it('should deny cross-user holding update', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerA@test.com', username: 'ownerA' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerB@test.com', username: 'ownerB' }
      });

      const portfolio = await createPortfolio(userA);
      const holding = await createHolding(userA, portfolio.id, asset.id, '1.5');

      const response = await userB.client.patch(`/v1/holdings/${holding.id}`, {
        body: { amount: '2.5' },
        headers: mutationHeaders(userB)
      });

      expect(response.status).toBe(404);
    });

    it('should deny cross-user holding delete', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerA@test.com', username: 'ownerA' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerB@test.com', username: 'ownerB' }
      });

      const portfolio = await createPortfolio(userA);
      const holding = await createHolding(userA, portfolio.id, asset.id, '1.5');

      const response = await userB.client.delete(`/v1/holdings/${holding.id}`, {
        headers: mutationHeaders(userB)
      });

      expect(response.status).toBe(404);
    });

    it('should not return userId or internal fields', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      await createHolding(auth, portfolio.id, asset.id, '1.5');

      const portfolioList = await auth.client.get('/v1/portfolios');

      expect(portfolioList.body[0]).not.toHaveProperty('userId');

      const holdingGet = await auth.client.get('/v1/holdings');

      expect(holdingGet.body.items[0]).not.toHaveProperty('userId');

      const holdingDetail = await auth.client.get(
        `/v1/portfolios/${portfolio.id}`
      );

      expect(holdingDetail.body).not.toHaveProperty('userId');
    });
  });

  describe('Valuation', () => {
    it('should require authentication', async () => {
      const client = new ApiClient(app);

      const response = await client.get(
        '/v1/portfolios/00000000-0000-4000-8000-000000000000/valuation'
      );

      expect(response.status).toBe(401);
    });

    it('should return 404 for another users portfolio', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerA@test.com', username: 'ownerA' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerB@test.com', username: 'ownerB' }
      });

      const portfolio = await createPortfolio(userA);

      const response = await userB.client.get(
        `/v1/portfolios/${portfolio.id}/valuation`
      );

      expect(response.status).toBe(404);
    });

    it('should return 404 for unknown portfolio', async () => {
      const auth = await AuthFactory.authenticated(app);

      const response = await auth.client.get(
        '/v1/portfolios/00000000-0000-4000-8000-000000000000/valuation'
      );

      expect(response.status).toBe(404);
    });

    it('should value a complete portfolio', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const bitcoin = await seedAsset();
      const ether = await seedAsset({
        coinGeckoId: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        currentPrice: '3000'
      });

      await createHolding(auth, portfolio.id, bitcoin.id, '1.5');
      await createHolding(auth, portfolio.id, ether.id, '2');

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/valuation`
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        portfolioId: portfolio.id,
        currency: 'USD',
        totalValue: '96000',
        status: 'COMPLETE',
        valuedHoldings: 2,
        unvaluedHoldings: 0
      });
      expect(response.body.holdings).toHaveLength(2);
      expect(response.body.holdings[0]).toMatchObject({
        holdingId: expect.any(String),
        assetId: bitcoin.id,
        symbol: 'btc',
        name: 'Bitcoin',
        amount: '1.500000000000000000',
        currentPrice: '60000.00000000',
        value: '90000'
      });
      expect(response.body.holdings[1]).toMatchObject({
        assetId: ether.id,
        symbol: 'eth',
        currentPrice: '3000.00000000',
        value: '6000'
      });
    });

    it('should report PARTIAL when some assets lack a price', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const bitcoin = await seedAsset();
      const ether = await seedAsset({
        coinGeckoId: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        currentPrice: null
      });

      await createHolding(auth, portfolio.id, bitcoin.id, '1.5');
      await createHolding(auth, portfolio.id, ether.id, '2');

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/valuation`
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        totalValue: '90000',
        status: 'PARTIAL',
        valuedHoldings: 1,
        unvaluedHoldings: 1
      });
      expect(response.body.holdings[1]).toMatchObject({
        currentPrice: null,
        value: null
      });
    });

    it('should report UNAVAILABLE when no asset has a price', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const bitcoin = await seedAsset({ currentPrice: null });
      const ether = await seedAsset({
        coinGeckoId: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        currentPrice: null
      });

      await createHolding(auth, portfolio.id, bitcoin.id, '1.5');
      await createHolding(auth, portfolio.id, ether.id, '2');

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/valuation`
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        totalValue: null,
        status: 'UNAVAILABLE',
        valuedHoldings: 0,
        unvaluedHoldings: 2
      });
    });

    it('should report EMPTY for a portfolio without holdings', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/valuation`
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        totalValue: null,
        status: 'EMPTY',
        valuedHoldings: 0,
        unvaluedHoldings: 0,
        holdings: []
      });
    });

    it('should value with exact decimal arithmetic', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const asset = await seedAsset({ currentPrice: '0.2' });

      await createHolding(auth, portfolio.id, asset.id, '0.1');

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/valuation`
      );

      expect(response.status).toBe(200);
      expect(response.body.holdings[0].value).toBe('0.02');
      expect(response.body.totalValue).toBe('0.02');
    });
  });
});
