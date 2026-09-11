import { Asset } from '@features/assets/domain/entities/asset.entity';
import { GET_USDT_TOMAN_USE_CASE } from '@features/market-overview/application/interfaces/usdt-toman.interface';
import { PortfolioTransaction } from '@features/portfolio/domain/entities/portfolio-transaction.entity';
import { PortfolioTransactionType } from '@features/portfolio/domain/enums/portfolio-transaction-type.enum';
import { TransactionPriceCurrency } from '@features/portfolio/domain/enums/transaction-price-currency.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

/** The USDT/Toman rate every test here converts at. */
const RATE = '234619';

/**
 * Toman-denominated BUY transactions end to end.
 *
 * The exchange boundary is stubbed at the market use case — no test reaches a
 * live venue — but the whole path below it is real: the DTO, the normalizer,
 * the exact-decimal conversion, the columns, and the response mapper. That is
 * what makes this worth having beside the unit tests: it proves the row that
 * actually lands in Postgres holds USD for the engine and Toman for the user.
 */
describe('Portfolio Toman transactions (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let rateSpy: jest.SpyInstance;

  beforeAll(async () => {
    const context = await createMigratedTestApp();
    app = context.app;
    dataSource = context.dataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
    jest.restoreAllMocks();

    rateSpy = jest
      .spyOn(app.get(GET_USDT_TOMAN_USE_CASE), 'execute')
      .mockResolvedValue({
        priceToman: RATE,
        priceChangePercentage24h: '3.3000',
        updatedAt: new Date('2026-09-10T09:00:00.000Z'),
        provider: 'nobitex',
        fetchedAt: new Date('2026-09-10T09:00:00.000Z'),
        isStale: false
      });
  });

  afterAll(async () => {
    await app?.close();
  });

  function mutationHeaders(ctx: AuthenticatedUserContext) {
    return { 'X-CSRF-Token': ctx.response.headers.xCsrfToken };
  }

  async function seedUsdtAsset(): Promise<Asset> {
    return dataSource.getRepository(Asset).save({
      coinGeckoId: 'tether',
      symbol: 'usdt',
      name: 'Tether',
      imageUrl: null,
      currentPrice: '1',
      marketCap: '120000000000',
      marketCapRank: 3,
      totalVolume: '50000000000',
      circulatingSupply: '120000000000',
      totalSupply: '120000000000',
      maxSupply: null,
      priceChange24h: '0.0001',
      priceChangePercentage24h: '0.01',
      lastSyncedAt: new Date('2026-09-10T09:00:00.000Z')
    });
  }

  async function createPortfolio(auth: AuthenticatedUserContext) {
    const response = await auth.client.post('/v1/portfolios', {
      body: { name: 'Toman Ledger', sourceType: 'WALLET' },
      headers: mutationHeaders(auth)
    });

    expect(response.status).toBe(201);

    return response.body as { id: string };
  }

  async function createTransaction(
    auth: AuthenticatedUserContext,
    portfolioId: string,
    body: Record<string, unknown>
  ) {
    return auth.client.post(`/v1/portfolios/${portfolioId}/transactions`, {
      body,
      headers: mutationHeaders(auth)
    });
  }

  /** Sets up an authenticated user with a USDT asset and an empty portfolio. */
  async function setup() {
    const auth = await AuthFactory.authenticated(app);
    const asset = await seedUsdtAsset();
    const portfolio = await createPortfolio(auth);

    return { auth, asset, portfolio };
  }

  it('should record a Toman BUY with USD stored for the engine and Toman for the user', async () => {
    const { auth, asset, portfolio } = await setup();

    // Step 4's worked example: 100 USDT at 234,000 with a 50,000 fee.
    const response = await createTransaction(auth, portfolio.id, {
      assetId: asset.id,
      type: PortfolioTransactionType.BUY,
      amount: '100',
      price: '234000',
      fee: '50000',
      priceCurrency: TransactionPriceCurrency.TOMAN,
      occurredAt: '2026-09-10T09:00:00.000Z'
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      amount: '100',
      // USD — what the cost-basis engine reads.
      price: '0.99736168',
      fee: '0.21311147',
      priceCurrency: TransactionPriceCurrency.TOMAN,
      // Toman — exactly what the user typed, to the digit.
      enteredPrice: '234000',
      enteredFee: '50000',
      usdtTomanRate: '234619'
    });

    // And the same values are what Postgres actually holds.
    const stored = await dataSource
      .getRepository(PortfolioTransaction)
      .findOneByOrFail({ id: response.body.id });

    expect(stored.price).toBe('0.99736168');
    expect(stored.enteredPrice).toBe('234000.00000000');
    expect(stored.priceCurrency).toBe(TransactionPriceCurrency.TOMAN);
  });

  it('should read the rate from the market service rather than the request', async () => {
    const { auth, asset, portfolio } = await setup();

    const response = await createTransaction(auth, portfolio.id, {
      assetId: asset.id,
      type: PortfolioTransactionType.BUY,
      amount: '100',
      price: '234000',
      priceCurrency: TransactionPriceCurrency.TOMAN,
      // A forged rate must be ignored — the DTO has no such field, and the
      // whitelisting pipe rejects it outright.
      usdtTomanRate: '1',
      occurredAt: '2026-09-10T09:00:00.000Z'
    });

    expect(response.status).toBe(422);
    expect(rateSpy).not.toHaveBeenCalled();
  });

  it('should keep the USD path untouched when no currency is supplied', async () => {
    const { auth, asset, portfolio } = await setup();

    const response = await createTransaction(auth, portfolio.id, {
      assetId: asset.id,
      type: PortfolioTransactionType.BUY,
      amount: '100',
      price: '1',
      fee: '2',
      occurredAt: '2026-09-10T09:00:00.000Z'
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      price: '1',
      fee: '2',
      priceCurrency: TransactionPriceCurrency.USD,
      enteredPrice: null,
      enteredFee: null,
      usdtTomanRate: null
    });
    // A USD transaction never needs a market lookup.
    expect(rateSpy).not.toHaveBeenCalled();
  });

  it('should accept a zero Toman fee', async () => {
    const { auth, asset, portfolio } = await setup();

    const response = await createTransaction(auth, portfolio.id, {
      assetId: asset.id,
      type: PortfolioTransactionType.BUY,
      amount: '100',
      price: '234000',
      fee: '0',
      priceCurrency: TransactionPriceCurrency.TOMAN,
      occurredAt: '2026-09-10T09:00:00.000Z'
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      fee: '0',
      enteredFee: '0'
    });
  });

  describe('rejections', () => {
    it.each([
      ['an unknown currency', { priceCurrency: 'EUR' }],
      ['a zero price', { price: '0' }],
      ['a negative price', { price: '-234000' }],
      ['a negative fee', { fee: '-50000' }],
      ['a malformed price', { price: '234,000' }],
      ['an exponent price', { price: '2.34e5' }]
    ])('should reject %s', async (_label, override) => {
      const { auth, asset, portfolio } = await setup();

      const response = await createTransaction(auth, portfolio.id, {
        assetId: asset.id,
        type: PortfolioTransactionType.BUY,
        amount: '100',
        price: '234000',
        fee: '50000',
        priceCurrency: TransactionPriceCurrency.TOMAN,
        occurredAt: '2026-09-10T09:00:00.000Z',
        ...override
      });

      // The validation pipe reports a malformed body as 422.
      expect(response.status).toBe(422);
    });

    // A denomination on a type that records no price is meaningless.
    it('should reject a Toman transfer', async () => {
      const { auth, asset, portfolio } = await setup();

      const response = await createTransaction(auth, portfolio.id, {
        assetId: asset.id,
        type: PortfolioTransactionType.TRANSFER_IN,
        amount: '100',
        priceCurrency: TransactionPriceCurrency.TOMAN,
        destinationType: 'EXCHANGE',
        exchangeName: 'Nobitex',
        occurredAt: '2026-09-10T09:00:00.000Z'
      });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe(
        'TRANSACTION_PRICE_CURRENCY_NOT_APPLICABLE'
      );
    });

    // Treating an unconvertible Toman figure as USD would record a price
    // roughly 234,000x too low, so the request has to fail instead.
    it('should reject a Toman BUY when no rate is available', async () => {
      const { auth, asset, portfolio } = await setup();
      rateSpy.mockRejectedValue(new Error('all providers failed'));

      const response = await createTransaction(auth, portfolio.id, {
        assetId: asset.id,
        type: PortfolioTransactionType.BUY,
        amount: '100',
        price: '234000',
        priceCurrency: TransactionPriceCurrency.TOMAN,
        occurredAt: '2026-09-10T09:00:00.000Z'
      });

      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe(
        'TRANSACTION_PRICE_RATE_UNAVAILABLE'
      );

      const count = await dataSource
        .getRepository(PortfolioTransaction)
        .count({ where: { portfolioId: portfolio.id } });

      expect(count).toBe(0);
    });
  });

  /**
   * The guarantee Step 7 asks for: a recorded transaction means what it meant
   * when it was written, whatever the market does afterwards.
   */
  describe('historical correctness', () => {
    it('should not restate a stored transaction when the rate moves', async () => {
      const { auth, asset, portfolio } = await setup();

      const created = await createTransaction(auth, portfolio.id, {
        assetId: asset.id,
        type: PortfolioTransactionType.BUY,
        amount: '100',
        price: '234000',
        fee: '50000',
        priceCurrency: TransactionPriceCurrency.TOMAN,
        occurredAt: '2026-09-10T09:00:00.000Z'
      });

      expect(created.status).toBe(201);

      // The market moves substantially after the fact.
      rateSpy.mockResolvedValue({
        priceToman: '250000',
        priceChangePercentage24h: '6.5500',
        updatedAt: new Date('2026-09-11T09:00:00.000Z'),
        provider: 'wallex',
        fetchedAt: new Date('2026-09-11T09:00:00.000Z'),
        isStale: false
      });

      const reread = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/transactions/${created.body.id}`
      );

      expect(reread.status).toBe(200);
      expect(reread.body).toMatchObject({
        price: '0.99736168',
        enteredPrice: '234000.00000000',
        // Still the rate it was written at, not today's.
        usdtTomanRate: '234619.00000000'
      });
    });

    it('should leave a transaction recorded before this field existed as USD', async () => {
      const { auth, asset, portfolio } = await setup();

      const [{ id: userId }] = (await dataSource.query(
        `SELECT "id" FROM "user" WHERE "email" = $1`,
        [auth.user.email]
      )) as { id: string }[];

      // Inserted without naming any of the new columns at all, which is
      // exactly the shape of a row written before the migration ran: the
      // enum default fills in and the three nullable columns stay empty.
      const [{ id: legacyId }] = (await dataSource.query(
        `INSERT INTO "portfolio_transaction"
           ("userId", "portfolioId", "assetId", "type", "amount", "price", "fee", "occurredAt")
         VALUES ($1, $2, $3, 'BUY', '2', '60000', '0.75', '2026-01-01T00:00:00.000Z')
         RETURNING "id"`,
        [userId, portfolio.id, asset.id]
      )) as { id: string }[];

      const response = await auth.client.get(
        `/v1/portfolios/${portfolio.id}/transactions/${legacyId}`
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        price: '60000.00000000',
        fee: '0.75000000',
        priceCurrency: TransactionPriceCurrency.USD,
        enteredPrice: null,
        enteredFee: null,
        usdtTomanRate: null
      });
    });
  });

  /**
   * The property the whole design rests on: whichever currency the user typed
   * in, the ledger sees one USD cost basis, so P&L is unaffected by the choice.
   */
  it('should give a Toman and a USD entry of the same trade the same cost basis', async () => {
    const { auth, asset, portfolio } = await setup();

    const inToman = await createTransaction(auth, portfolio.id, {
      assetId: asset.id,
      type: PortfolioTransactionType.BUY,
      amount: '100',
      // 1 USD expressed in Toman at this rate.
      price: RATE,
      priceCurrency: TransactionPriceCurrency.TOMAN,
      occurredAt: '2026-09-10T09:00:00.000Z'
    });

    const inUsd = await createTransaction(auth, portfolio.id, {
      assetId: asset.id,
      type: PortfolioTransactionType.BUY,
      amount: '100',
      price: '1',
      occurredAt: '2026-09-10T09:00:00.000Z'
    });

    expect(inToman.status).toBe(201);
    expect(inUsd.status).toBe(201);
    expect(inToman.body.price).toBe(inUsd.body.price);
  });
});
