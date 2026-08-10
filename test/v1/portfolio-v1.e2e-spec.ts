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

  async function createTransaction(
    auth: AuthenticatedUserContext,
    portfolioId: string,
    assetId: string,
    body: Record<string, unknown>
  ) {
    const response = await auth.client.post(
      `/v1/portfolios/${portfolioId}/transactions`,
      {
        body: { assetId, ...body },
        headers: mutationHeaders(auth)
      }
    );

    return response;
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

    it('should update a portfolio name', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await auth.client.patch(
        `/v1/portfolios/${portfolio.id}`,
        {
          body: { name: 'Updated Ledger' },
          headers: mutationHeaders(auth)
        }
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: portfolio.id,
        name: 'Updated Ledger',
        sourceType: 'WALLET'
      });
    });

    it('should update portfolio sourceType and clear walletAddress', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth, {
        name: 'My Wallet',
        sourceType: 'WALLET',
        walletAddress: '0x1234...'
      });

      const response = await auth.client.patch(
        `/v1/portfolios/${portfolio.id}`,
        {
          body: { sourceType: 'EXCHANGE', walletAddress: null },
          headers: mutationHeaders(auth)
        }
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: portfolio.id,
        name: 'My Wallet',
        sourceType: 'EXCHANGE',
        walletAddress: null
      });
    });

    it('should reject empty portfolio update', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await auth.client.patch(
        `/v1/portfolios/${portfolio.id}`,
        {
          body: {},
          headers: mutationHeaders(auth)
        }
      );

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('PORTFOLIO_EMPTY_UPDATE');
    });

    it('should return 404 when updating another users portfolio', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerA@test.com', username: 'ownerA' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerB@test.com', username: 'ownerB' }
      });

      const portfolio = await createPortfolio(userA);

      const response = await userB.client.patch(
        `/v1/portfolios/${portfolio.id}`,
        {
          body: { name: 'Hacked' },
          headers: mutationHeaders(userB)
        }
      );

      expect(response.status).toBe(404);
    });

    it('should return 404 when updating nonexistent portfolio', async () => {
      const auth = await AuthFactory.authenticated(app);

      const response = await auth.client.patch(
        '/v1/portfolios/00000000-0000-4000-8000-000000000000',
        {
          body: { name: 'Updated' },
          headers: mutationHeaders(auth)
        }
      );

      expect(response.status).toBe(404);
    });

    it('should delete a portfolio', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await auth.client.delete(
        `/v1/portfolios/${portfolio.id}`,
        { headers: mutationHeaders(auth) }
      );

      expect(response.status).toBe(204);

      const getResponse = await auth.client.get(
        `/v1/portfolios/${portfolio.id}`
      );
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 when deleting another users portfolio', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerA@test.com', username: 'ownerA' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerB@test.com', username: 'ownerB' }
      });

      const portfolio = await createPortfolio(userA);

      const response = await userB.client.delete(
        `/v1/portfolios/${portfolio.id}`,
        { headers: mutationHeaders(userB) }
      );

      expect(response.status).toBe(404);

      const getResponse = await userA.client.get(
        `/v1/portfolios/${portfolio.id}`
      );
      expect(getResponse.status).toBe(200);
    });

    it('should return 404 when deleting nonexistent portfolio', async () => {
      const auth = await AuthFactory.authenticated(app);

      const response = await auth.client.delete(
        '/v1/portfolios/00000000-0000-4000-8000-000000000000',
        { headers: mutationHeaders(auth) }
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

  describe('Transactions', () => {
    let asset: Asset;

    beforeEach(async () => {
      asset = await seedAsset();
    });

    it('should require authentication', async () => {
      const client = new ApiClient(app);
      const portfolioId = '00000000-0000-4000-8000-000000000000';

      const postResponse = await client.post(
        `/v1/portfolios/${portfolioId}/transactions`,
        {
          body: {
            assetId: asset.id,
            type: 'BUY',
            amount: '1.5',
            price: '60000',
            occurredAt: '2026-07-28T08:00:00.000Z'
          }
        }
      );

      expect(postResponse.status).toBe(401);

      const getResponse = await client.get(
        `/v1/portfolios/${portfolioId}/transactions`
      );

      expect(getResponse.status).toBe(401);
    });

    it('should record a BUY transaction with the supplied price and instant', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.5',
        price: '60000.50',
        fee: '0.75',
        occurredAt: '2026-07-28T08:00:00.000Z',
        notes: 'Dollar-cost average'
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        portfolioId: portfolio.id,
        assetId: asset.id,
        type: 'BUY',
        amount: '0.5',
        price: '60000.50',
        fee: '0.75',
        occurredAt: '2026-07-28T08:00:00.000Z',
        notes: 'Dollar-cost average',
        asset: { id: asset.id, symbol: 'btc', name: 'Bitcoin' }
      });
      expect(response.body.id).toEqual(expect.any(String));
      expect(response.body.createdAt).toEqual(expect.any(String));
      expect(response.body.updatedAt).toEqual(expect.any(String));
      expect(response.body).not.toHaveProperty('userId');
    });

    it('should record a TRANSFER_IN without a price', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'TRANSFER_IN',
        amount: '0.25',
        occurredAt: '2026-07-28T09:00:00.000Z'
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        type: 'TRANSFER_IN',
        price: null,
        fee: null
      });
    });

    it('should reject a BUY without a price', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.5',
        occurredAt: '2026-07-28T08:00:00.000Z'
      });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('TRANSACTION_PRICE_REQUIRED');
    });

    it('should reject DEPOSIT and WITHDRAWAL types', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const deposit = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'DEPOSIT',
        amount: '1000',
        occurredAt: '2026-07-28T08:00:00.000Z'
      });

      expect(deposit.status).toBe(422);
      expect(deposit.body.error.code).toBe('TRANSACTION_TYPE_NOT_SUPPORTED');

      const withdrawal = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'WITHDRAWAL',
        amount: '1000',
        occurredAt: '2026-07-28T08:00:00.000Z'
      });

      expect(withdrawal.status).toBe(422);
      expect(withdrawal.body.error.code).toBe('TRANSACTION_TYPE_NOT_SUPPORTED');
    });

    it('should reject prices with more than 8 fractional digits', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.5',
        price: '1.123456789',
        occurredAt: '2026-07-28T08:00:00.000Z'
      });

      expect(response.status).toBe(422);
    });

    it('should reject a zero amount and a negative fee', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const zeroAmount = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0',
        price: '60000',
        occurredAt: '2026-07-28T08:00:00.000Z'
      });

      expect(zeroAmount.status).toBe(422);

      const negativeFee = await createTransaction(
        auth,
        portfolio.id,
        asset.id,
        {
          type: 'BUY',
          amount: '0.5',
          price: '60000',
          fee: '-1',
          occurredAt: '2026-07-28T08:00:00.000Z'
        }
      );

      expect(negativeFee.status).toBe(422);
    });

    it('should accept a zero fee', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'SELL',
        amount: '0.5',
        price: '60000',
        fee: '0',
        occurredAt: '2026-07-28T08:00:00.000Z'
      });

      expect(response.status).toBe(201);
      expect(response.body.fee).toBe('0');
    });

    it('should reject a non-existent asset', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await createTransaction(auth, portfolio.id, asset.id, {
        assetId: '00000000-0000-4000-8000-000000000000',
        type: 'BUY',
        amount: '0.5',
        price: '60000',
        occurredAt: '2026-07-28T08:00:00.000Z'
      });

      expect(response.status).toBe(404);
    });

    it('should deny cross-user portfolio access', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerA@test.com', username: 'ownerA' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerB@test.com', username: 'ownerB' }
      });

      const portfolio = await createPortfolio(userA);

      const response = await createTransaction(userB, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.5',
        price: '60000',
        occurredAt: '2026-07-28T08:00:00.000Z'
      });

      expect(response.status).toBe(404);
    });

    it('should list transactions newest first', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.5',
        price: '60000',
        occurredAt: '2026-07-01T08:00:00.000Z'
      });
      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'SELL',
        amount: '0.2',
        price: '61000',
        occurredAt: '2026-07-02T08:00:00.000Z'
      });
      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'TRANSFER_IN',
        amount: '0.3',
        occurredAt: '2026-07-03T08:00:00.000Z'
      });

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/transactions`
      );

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(3);
      expect(response.body.nextCursor).toBeNull();
      expect(response.body.items.map((t: { type: string }) => t.type)).toEqual([
        'TRANSFER_IN',
        'SELL',
        'BUY'
      ]);
      expect(response.body.items[0].asset.symbol).toBe('btc');
    });

    it('should paginate with the returned cursor', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.1',
        price: '60000',
        occurredAt: '2026-07-01T08:00:00.000Z'
      });
      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.2',
        price: '60000',
        occurredAt: '2026-07-02T08:00:00.000Z'
      });
      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.3',
        price: '60000',
        occurredAt: '2026-07-03T08:00:00.000Z'
      });

      const firstPage = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/transactions`,
        { query: { limit: 2 } }
      );

      expect(firstPage.status).toBe(200);
      expect(firstPage.body.items).toHaveLength(2);
      expect(firstPage.body.items[0].amount).toBe('0.300000000000000000');
      expect(firstPage.body.nextCursor).toEqual(expect.any(String));

      const secondPage = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/transactions`,
        { query: { limit: 2, cursor: firstPage.body.nextCursor } }
      );

      expect(secondPage.status).toBe(200);
      expect(secondPage.body.items).toHaveLength(1);
      expect(secondPage.body.items[0].amount).toBe('0.100000000000000000');
      expect(secondPage.body.nextCursor).toBeNull();
    });

    it('should filter by type, asset, and time window', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const ether = await seedAsset({
        coinGeckoId: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        currentPrice: '3000'
      });

      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.5',
        price: '60000',
        occurredAt: '2026-07-01T08:00:00.000Z'
      });
      await createTransaction(auth, portfolio.id, ether.id, {
        type: 'BUY',
        amount: '2',
        price: '3000',
        occurredAt: '2026-07-02T08:00:00.000Z'
      });
      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'SELL',
        amount: '0.2',
        price: '61000',
        occurredAt: '2026-07-03T08:00:00.000Z'
      });

      const byType = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/transactions`,
        { query: { type: 'SELL' } }
      );
      expect(byType.body.items).toHaveLength(1);
      expect(byType.body.items[0].assetId).toBe(asset.id);

      const byAsset = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/transactions`,
        { query: { assetId: ether.id } }
      );
      expect(byAsset.body.items).toHaveLength(1);
      expect(byAsset.body.items[0].assetId).toBe(ether.id);

      const byWindow = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/transactions`,
        {
          query: {
            from: '2026-07-02T00:00:00.000Z',
            to: '2026-07-02T23:59:59.999Z'
          }
        }
      );
      expect(byWindow.body.items).toHaveLength(1);
      expect(byWindow.body.items[0].assetId).toBe(ether.id);
    });

    it('should reject an invalid cursor', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/transactions`,
        { query: { cursor: 'not-a-cursor' } }
      );

      expect(response.status).toBe(400);
    });

    it('should get a transaction by id', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const created = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.5',
        price: '60000.50',
        occurredAt: '2026-07-28T08:00:00.000Z'
      });

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/transactions/${created.body.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: created.body.id,
        type: 'BUY',
        amount: '0.500000000000000000',
        price: '60000.50000000'
      });
      expect(response.body).not.toHaveProperty('userId');
    });

    it('should return 404 for another users transaction', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerA@test.com', username: 'ownerA' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerB@test.com', username: 'ownerB' }
      });

      const portfolio = await createPortfolio(userA);
      const created = await createTransaction(userA, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.5',
        price: '60000',
        occurredAt: '2026-07-28T08:00:00.000Z'
      });

      const response = await userB.client.get(
        `/v1/portfolios/${portfolio.id}/transactions/${created.body.id}`
      );

      expect(response.status).toBe(404);
    });

    it('should delete a transaction', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const created = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.5',
        price: '60000',
        occurredAt: '2026-07-28T08:00:00.000Z'
      });

      const response = await auth.client.delete(
        `/v1/portfolios/${portfolio.id}/transactions/${created.body.id}`,
        { headers: mutationHeaders(auth) }
      );

      expect(response.status).toBe(204);

      const list = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/transactions`
      );
      expect(list.body.items).toHaveLength(0);
    });

    it('should deny cross-user transaction delete', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerA@test.com', username: 'ownerA' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerB@test.com', username: 'ownerB' }
      });

      const portfolio = await createPortfolio(userA);
      const created = await createTransaction(userA, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.5',
        price: '60000',
        occurredAt: '2026-07-28T08:00:00.000Z'
      });

      const response = await userB.client.delete(
        `/v1/portfolios/${portfolio.id}/transactions/${created.body.id}`,
        { headers: mutationHeaders(userB) }
      );

      expect(response.status).toBe(404);
    });

    it('should update a transaction', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const createResponse = await createTransaction(
        auth,
        portfolio.id,
        asset.id,
        {
          type: 'BUY',
          amount: '1.5',
          price: '60000',
          fee: '0.75',
          occurredAt: '2026-07-28T08:00:00.000Z',
          notes: 'Original'
        }
      );
      expect(createResponse.status).toBe(201);

      const updateResponse = await auth.client.patch(
        `/v1/portfolios/${portfolio.id}/transactions/${createResponse.body.id}`,
        {
          body: { amount: '2.0', price: '65000', notes: 'Updated' },
          headers: mutationHeaders(auth)
        }
      );

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body).toMatchObject({
        id: createResponse.body.id,
        amount: '2.000000000000000000',
        price: '65000.00000000',
        notes: 'Updated',
        type: 'BUY'
      });
    });

    it('should change transaction type from BUY to TRANSFER_IN and clear price', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const createResponse = await createTransaction(
        auth,
        portfolio.id,
        asset.id,
        {
          type: 'BUY',
          amount: '1.0',
          price: '60000',
          occurredAt: '2026-07-28T08:00:00.000Z'
        }
      );

      const updateResponse = await auth.client.patch(
        `/v1/portfolios/${portfolio.id}/transactions/${createResponse.body.id}`,
        {
          body: { type: 'TRANSFER_IN', price: null },
          headers: mutationHeaders(auth)
        }
      );

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body).toMatchObject({
        type: 'TRANSFER_IN',
        price: null
      });
    });

    it('should clear fee and notes with null', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const createResponse = await createTransaction(
        auth,
        portfolio.id,
        asset.id,
        {
          type: 'BUY',
          amount: '1.0',
          price: '60000',
          fee: '0.5',
          occurredAt: '2026-07-28T08:00:00.000Z',
          notes: 'Will be cleared'
        }
      );

      const updateResponse = await auth.client.patch(
        `/v1/portfolios/${portfolio.id}/transactions/${createResponse.body.id}`,
        {
          body: { fee: null, notes: null },
          headers: mutationHeaders(auth)
        }
      );

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.fee).toBeNull();
      expect(updateResponse.body.notes).toBeNull();
    });

    it('should reject empty transaction update', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const createResponse = await createTransaction(
        auth,
        portfolio.id,
        asset.id,
        {
          type: 'BUY',
          amount: '1.0',
          price: '60000',
          occurredAt: '2026-07-28T08:00:00.000Z'
        }
      );

      const updateResponse = await auth.client.patch(
        `/v1/portfolios/${portfolio.id}/transactions/${createResponse.body.id}`,
        {
          body: {},
          headers: mutationHeaders(auth)
        }
      );

      expect(updateResponse.status).toBe(422);
      expect(updateResponse.body.error.code).toBe('TRANSACTION_EMPTY_UPDATE');
    });

    it('should reject updating transaction in another users portfolio', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerA@test.com', username: 'ownerA' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'ownerB@test.com', username: 'ownerB' }
      });

      const portfolio = await createPortfolio(userA);

      const createResponse = await createTransaction(
        userA,
        portfolio.id,
        asset.id,
        {
          type: 'BUY',
          amount: '1.0',
          price: '60000',
          occurredAt: '2026-07-28T08:00:00.000Z'
        }
      );

      const updateResponse = await userB.client.patch(
        `/v1/portfolios/${portfolio.id}/transactions/${createResponse.body.id}`,
        {
          body: { amount: '10.0' },
          headers: mutationHeaders(userB)
        }
      );

      expect(updateResponse.status).toBe(404);
    });

    it('should reject updating nonexistent transaction', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const updateResponse = await auth.client.patch(
        `/v1/portfolios/${portfolio.id}/transactions/00000000-0000-4000-8000-000000000000`,
        {
          body: { amount: '10.0' },
          headers: mutationHeaders(auth)
        }
      );

      expect(updateResponse.status).toBe(404);
    });

    it('should reject clearing price on BUY transaction', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const createResponse = await createTransaction(
        auth,
        portfolio.id,
        asset.id,
        {
          type: 'BUY',
          amount: '1.0',
          price: '60000',
          occurredAt: '2026-07-28T08:00:00.000Z'
        }
      );

      const updateResponse = await auth.client.patch(
        `/v1/portfolios/${portfolio.id}/transactions/${createResponse.body.id}`,
        {
          body: { price: null },
          headers: mutationHeaders(auth)
        }
      );

      expect(updateResponse.status).toBe(422);
      expect(updateResponse.body.error.code).toBe('TRANSACTION_PRICE_REQUIRED');
    });

    it('should reject updating to unsupported DEPOSIT type', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const createResponse = await createTransaction(
        auth,
        portfolio.id,
        asset.id,
        {
          type: 'BUY',
          amount: '1.0',
          price: '60000',
          occurredAt: '2026-07-28T08:00:00.000Z'
        }
      );

      const updateResponse = await auth.client.patch(
        `/v1/portfolios/${portfolio.id}/transactions/${createResponse.body.id}`,
        {
          body: { type: 'DEPOSIT' },
          headers: mutationHeaders(auth)
        }
      );

      expect(updateResponse.status).toBe(422);
      expect(updateResponse.body.error.code).toBe(
        'TRANSACTION_TYPE_NOT_SUPPORTED'
      );
    });

    it('should preserve decimal precision when updating amounts', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const createResponse = await createTransaction(
        auth,
        portfolio.id,
        asset.id,
        {
          type: 'BUY',
          amount: '1.000000000000000001',
          price: '60000.12345678',
          occurredAt: '2026-07-28T08:00:00.000Z'
        }
      );

      const updateResponse = await auth.client.patch(
        `/v1/portfolios/${portfolio.id}/transactions/${createResponse.body.id}`,
        {
          body: { amount: '2.000000000000000002', price: '65000.87654321' },
          headers: mutationHeaders(auth)
        }
      );

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.amount).toBe('2.000000000000000002');
      expect(updateResponse.body.price).toBe('65000.87654321');
    });

    it('should keep the recorded price when the live price changes', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const created = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.1',
        price: '50000',
        occurredAt: '2026-07-28T08:00:00.000Z'
      });

      await dataSource.getRepository(Asset).update(asset.id, {
        currentPrice: '99999'
      });

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/transactions/${created.body.id}`
      );

      expect(response.status).toBe(200);
      expect(response.body.price).toBe('50000.00000000');
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
  describe('P&L', () => {
    it('should require authentication', async () => {
      const client = new ApiClient(app);

      const response = await client.get(
        '/v1/portfolios/00000000-0000-4000-8000-000000000000/pnl'
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
        `/v1/portfolios/${portfolio.id}/pnl`
      );

      expect(response.status).toBe(404);
    });

    it('should return 404 for an unknown portfolio', async () => {
      const auth = await AuthFactory.authenticated(app);

      const response = await auth.client.get(
        '/v1/portfolios/00000000-0000-4000-8000-000000000000/pnl'
      );

      expect(response.status).toBe(404);
    });

    it('should report zero totals and no positions for an empty portfolio', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/pnl`
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        portfolioId: portfolio.id,
        currency: 'USD',
        costBasis: 'AVERAGE',
        pricedPositions: 0,
        unpricedPositions: 0,
        totalCurrentValue: '0',
        totalCostBasis: '0',
        totalRealizedPnl: '0',
        totalUnrealizedPnl: '0',
        totalPnl: '0',
        positions: []
      });
    });

    it('should compute current value exactly', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const asset = await seedAsset({ currentPrice: '60000' });

      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '1',
        price: '50000',
        occurredAt: '2026-07-01T08:00:00.000Z'
      });

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/pnl`
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        totalCurrentValue: '60000',
        totalCostBasis: '50000',
        totalRealizedPnl: '0',
        totalUnrealizedPnl: '10000',
        totalPnl: '10000',
        positions: [
          {
            assetId: asset.id,
            symbol: 'btc',
            name: 'Bitcoin',
            quantity: '1',
            totalCost: '50000',
            averageCost: '50000',
            currentPrice: '60000.00000000',
            currentValue: '60000',
            realizedPnl: '0',
            unrealizedPnl: '10000',
            totalPnl: '10000',
            realizedPnlEvents: []
          }
        ]
      });
    });

    it('should compute P&L with the default AVERAGE strategy', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const asset = await seedAsset({ currentPrice: '70000' });

      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '2',
        price: '50000',
        occurredAt: '2026-07-01T08:00:00.000Z'
      });
      const sell = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'SELL',
        amount: '1',
        price: '60000',
        occurredAt: '2026-07-02T08:00:00.000Z'
      });
      expect(sell.status).toBe(201);

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/pnl`
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        costBasis: 'AVERAGE',
        pricedPositions: 1,
        unpricedPositions: 0,
        totalCurrentValue: '70000',
        totalCostBasis: '50000',
        totalRealizedPnl: '10000',
        totalUnrealizedPnl: '20000',
        totalPnl: '30000',
        positions: [
          {
            quantity: '1',
            totalCost: '50000',
            averageCost: '50000',
            currentValue: '70000',
            realizedPnl: '10000',
            unrealizedPnl: '20000',
            totalPnl: '30000',
            realizedPnlEvents: [
              {
                transactionId: sell.body.id,
                type: 'SELL',
                amount: '1.000000000000000000',
                price: '60000.00000000',
                proceeds: '60000',
                releasedCostBasis: '50000',
                realizedPnl: '10000'
              }
            ]
          }
        ]
      });
    });

    it('should honor an explicit AVERAGE strategy', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const asset = await seedAsset();

      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '1',
        price: '100',
        occurredAt: '2026-07-01T08:00:00.000Z'
      });

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/pnl?costBasis=AVERAGE`
      );

      expect(response.status).toBe(200);
      expect(response.body.costBasis).toBe('AVERAGE');
      expect(response.body.positions[0]).toMatchObject({
        realizedPnl: '0',
        realizedPnlEvents: []
      });
    });

    it('should compute FIFO cost basis', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const asset = await seedAsset();

      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '1',
        price: '100',
        occurredAt: '2026-07-01T08:00:00.000Z'
      });
      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '1',
        price: '200',
        occurredAt: '2026-07-02T08:00:00.000Z'
      });
      const sell = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'SELL',
        amount: '1',
        price: '150',
        occurredAt: '2026-07-03T08:00:00.000Z'
      });
      expect(sell.status).toBe(201);

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/pnl?costBasis=FIFO`
      );

      expect(response.status).toBe(200);
      expect(response.body.costBasis).toBe('FIFO');
      expect(response.body.positions[0]).toMatchObject({
        totalCost: '200',
        realizedPnl: '50',
        realizedPnlEvents: [
          {
            type: 'SELL',
            amount: '1.000000000000000000',
            price: '150.00000000',
            proceeds: '150',
            releasedCostBasis: '100',
            realizedPnl: '50'
          }
        ]
      });
    });

    it('should compute LIFO cost basis', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const asset = await seedAsset();

      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '1',
        price: '100',
        occurredAt: '2026-07-01T08:00:00.000Z'
      });
      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '1',
        price: '200',
        occurredAt: '2026-07-02T08:00:00.000Z'
      });
      const sell = await createTransaction(auth, portfolio.id, asset.id, {
        type: 'SELL',
        amount: '1',
        price: '150',
        occurredAt: '2026-07-03T08:00:00.000Z'
      });
      expect(sell.status).toBe(201);

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/pnl?costBasis=LIFO`
      );

      expect(response.status).toBe(200);
      expect(response.body.costBasis).toBe('LIFO');
      expect(response.body.positions[0]).toMatchObject({
        totalCost: '100',
        realizedPnl: '-50',
        realizedPnlEvents: [
          {
            type: 'SELL',
            amount: '1.000000000000000000',
            price: '150.00000000',
            proceeds: '150',
            releasedCostBasis: '200',
            realizedPnl: '-50'
          }
        ]
      });
    });

    it('should realize zero-basis gains for a TRANSFER_IN followed by a SELL', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const asset = await seedAsset();

      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'TRANSFER_IN',
        amount: '1',
        occurredAt: '2026-07-01T08:00:00.000Z'
      });
      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'SELL',
        amount: '1',
        price: '60000',
        occurredAt: '2026-07-02T08:00:00.000Z'
      });

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/pnl`
      );

      expect(response.status).toBe(200);
      expect(response.body.positions[0]).toMatchObject({
        quantity: '0',
        totalCost: '0',
        realizedPnl: '60000',
        totalPnl: '60000',
        realizedPnlEvents: [
          {
            type: 'SELL',
            releasedCostBasis: '0',
            realizedPnl: '60000'
          }
        ]
      });
    });

    it('should not realize P&L for a TRANSFER_OUT', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const asset = await seedAsset();

      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'TRANSFER_IN',
        amount: '1',
        occurredAt: '2026-07-01T08:00:00.000Z'
      });
      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'TRANSFER_OUT',
        amount: '1',
        occurredAt: '2026-07-02T08:00:00.000Z'
      });

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/pnl`
      );

      expect(response.status).toBe(200);
      expect(response.body.positions[0]).toMatchObject({
        quantity: '0',
        realizedPnl: '0',
        realizedPnlEvents: []
      });
    });

    it('should report null values when the asset has no current price', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const asset = await seedAsset({ currentPrice: null });

      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '1',
        price: '50000',
        occurredAt: '2026-07-01T08:00:00.000Z'
      });

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/pnl`
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        pricedPositions: 0,
        unpricedPositions: 1,
        totalCurrentValue: null,
        totalCostBasis: '50000',
        totalRealizedPnl: '0',
        totalUnrealizedPnl: null,
        totalPnl: null,
        positions: [
          {
            currentPrice: null,
            currentValue: null,
            unrealizedPnl: null,
            totalPnl: null,
            realizedPnl: '0'
          }
        ]
      });
    });

    it('should calculate each asset independently', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const bitcoin = await seedAsset({ currentPrice: '60000' });
      const ether = await seedAsset({
        coinGeckoId: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        currentPrice: '2500'
      });

      await createTransaction(auth, portfolio.id, bitcoin.id, {
        type: 'BUY',
        amount: '2',
        price: '50000',
        occurredAt: '2026-07-01T08:00:00.000Z'
      });
      await createTransaction(auth, portfolio.id, ether.id, {
        type: 'BUY',
        amount: '3',
        price: '2000',
        occurredAt: '2026-07-02T08:00:00.000Z'
      });

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/pnl`
      );

      expect(response.status).toBe(200);
      expect(response.body.positions).toHaveLength(2);
      expect(response.body.positions[0]).toMatchObject({
        symbol: 'btc',
        quantity: '2',
        totalCost: '100000',
        currentValue: '120000'
      });
      expect(response.body.positions[1]).toMatchObject({
        symbol: 'eth',
        quantity: '3',
        totalCost: '6000',
        currentValue: '7500'
      });
      expect(response.body).toMatchObject({
        totalCurrentValue: '127500',
        totalCostBasis: '106000',
        totalRealizedPnl: '0',
        totalUnrealizedPnl: '21500',
        totalPnl: '21500'
      });
    });

    it('should reject an invalid cost-basis strategy', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/pnl?costBasis=INVALID`
      );

      expect(response.status).toBe(422);
    });

    it('should keep exact decimal precision', async () => {
      const auth = await AuthFactory.authenticated(app);
      const portfolio = await createPortfolio(auth);
      const asset = await seedAsset({ currentPrice: '0.3' });

      await createTransaction(auth, portfolio.id, asset.id, {
        type: 'BUY',
        amount: '0.1',
        price: '0.2',
        occurredAt: '2026-07-01T08:00:00.000Z'
      });

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/pnl`
      );

      expect(response.status).toBe(200);
      expect(response.body.positions[0]).toMatchObject({
        quantity: '0.1',
        totalCost: '0.02',
        currentPrice: '0.30000000',
        currentValue: '0.03',
        unrealizedPnl: '0.01',
        totalPnl: '0.01'
      });
    });
  });
});
