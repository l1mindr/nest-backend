import { Asset } from '@features/assets/domain/entities/asset.entity';
import { Holding } from '@features/portfolio/domain/entities/holding.entity';
import { PortfolioOpeningBalance } from '@features/portfolio/domain/entities/portfolio-opening-balance.entity';
import { PortfolioTransaction } from '@features/portfolio/domain/entities/portfolio-transaction.entity';
import { Portfolio } from '@features/portfolio/domain/entities/portfolio.entity';
import { PortfolioSourceType } from '@features/portfolio/domain/enums/portfolio-source-type.enum';
import { PortfolioTransactionType } from '@features/portfolio/domain/enums/portfolio-transaction-type.enum';
import { HoldingRepository } from '@features/portfolio/infrastructure/repositories/holding.repository';
import { PortfolioOpeningBalanceRepository } from '@features/portfolio/infrastructure/repositories/portfolio-opening-balance.repository';
import { PortfolioTransactionRepository } from '@features/portfolio/infrastructure/repositories/portfolio-transaction.repository';
import { PortfolioRepository } from '@features/portfolio/infrastructure/repositories/portfolio.repository';
import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

describe('Portfolio repositories (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let portfolioRepository: PortfolioRepository;
  let holdingRepository: HoldingRepository;
  let transactionRepository: PortfolioTransactionRepository;
  let openingBalanceRepository: PortfolioOpeningBalanceRepository;

  beforeAll(async () => {
    const context = await createMigratedTestApp();

    app = context.app;
    dataSource = context.dataSource;
    portfolioRepository = app.get(PortfolioRepository);
    holdingRepository = app.get(HoldingRepository);
    transactionRepository = app.get(PortfolioTransactionRepository);
    openingBalanceRepository = app.get(PortfolioOpeningBalanceRepository);
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('PortfolioRepository', () => {
    it('should create and return a portfolio with timestamps', async () => {
      const user = await seedUser('owner-a@test.com', 'ownera');

      const portfolio = await portfolioRepository.create({
        userId: user.id,
        name: 'My Ledger',
        sourceType: PortfolioSourceType.WALLET,
        walletAddress: '0x1234'
      });

      expect(portfolio).toMatchObject({
        id: expect.any(String),
        userId: user.id,
        name: 'My Ledger',
        sourceType: PortfolioSourceType.WALLET,
        walletAddress: '0x1234'
      });
      expect(portfolio.createdAt).toEqual(expect.any(Date));
      expect(portfolio.updatedAt).toEqual(expect.any(Date));
    });

    it('should find a portfolio only when it belongs to the user', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const other = await seedUser('owner-b@test.com', 'ownerb');
      const portfolio = await seedPortfolio(owner.id);

      await expect(
        portfolioRepository.findByIdAndUser(portfolio.id, owner.id)
      ).resolves.toEqual(expect.objectContaining({ id: portfolio.id }));
      await expect(
        portfolioRepository.findByIdAndUser(portfolio.id, other.id)
      ).resolves.toBeNull();
      await expect(
        portfolioRepository.findByIdAndUser(uuid(255), owner.id)
      ).resolves.toBeNull();
    });

    it('should list only the owning users portfolios, newest first', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const other = await seedUser('owner-b@test.com', 'ownerb');

      const first = await seedPortfolio(owner.id, { name: 'First' });
      const second = await seedPortfolio(owner.id, { name: 'Second' });
      await seedPortfolio(other.id, { name: 'Other' });

      await setCreatedAt(
        'portfolio',
        first.id,
        new Date('2026-01-01T00:00:00.000Z')
      );
      await setCreatedAt(
        'portfolio',
        second.id,
        new Date('2026-02-01T00:00:00.000Z')
      );

      const result = await portfolioRepository.findByUserId(owner.id);

      expect(result.map((item) => item.name)).toEqual(['Second', 'First']);
    });

    it('should update a portfolio only when it belongs to the user', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const other = await seedUser('owner-b@test.com', 'ownerb');
      const portfolio = await seedPortfolio(owner.id);

      const updated = await portfolioRepository.update(portfolio.id, owner.id, {
        name: 'Renamed'
      });
      expect(updated?.name).toBe('Renamed');

      const foreign = await portfolioRepository.update(portfolio.id, other.id, {
        name: 'Hacked'
      });
      expect(foreign).toBeNull();

      const persisted = await portfolioRepository.findByIdAndUser(
        portfolio.id,
        owner.id
      );
      expect(persisted?.name).toBe('Renamed');
    });

    it('should delete a portfolio only when it belongs to the user', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const other = await seedUser('owner-b@test.com', 'ownerb');
      const portfolio = await seedPortfolio(owner.id);

      await expect(
        portfolioRepository.delete(portfolio.id, other.id)
      ).resolves.toBe(false);
      await expect(
        portfolioRepository.delete(portfolio.id, owner.id)
      ).resolves.toBe(true);
      await expect(
        portfolioRepository.delete(portfolio.id, owner.id)
      ).resolves.toBe(false);
    });
  });

  describe('HoldingRepository', () => {
    it('should create and return a holding with the supplied decimal amount', async () => {
      const user = await seedUser('owner-a@test.com', 'ownera');
      const asset = await seedAsset();
      const portfolio = await seedPortfolio(user.id);

      const holding = await holdingRepository.create({
        userId: user.id,
        portfolioId: portfolio.id,
        assetId: asset.id,
        amount: '1.5',
        notes: 'Cold storage'
      });

      expect(holding).toMatchObject({
        id: expect.any(String),
        userId: user.id,
        portfolioId: portfolio.id,
        assetId: asset.id,
        amount: '1.5',
        notes: 'Cold storage'
      });
      expect(holding.createdAt).toEqual(expect.any(Date));
    });

    it('should find a holding with its asset and portfolio only for the owning user', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const other = await seedUser('owner-b@test.com', 'ownerb');
      const asset = await seedAsset();
      const portfolio = await seedPortfolio(owner.id);
      const holding = await seedHolding(owner, portfolio, asset);

      const found = await holdingRepository.findByIdAndUser(
        holding.id,
        owner.id
      );

      expect(found).toMatchObject({
        id: holding.id,
        asset: { id: asset.id, symbol: 'btc', name: 'Bitcoin' },
        portfolio: { id: portfolio.id, name: 'My Ledger' }
      });
      await expect(
        holdingRepository.findByIdAndUser(holding.id, other.id)
      ).resolves.toBeNull();
    });

    it('should find a holding by portfolio and asset', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const asset = await seedAsset();
      const portfolio = await seedPortfolio(owner.id);
      const holding = await seedHolding(owner, portfolio, asset);

      await expect(
        holdingRepository.findByPortfolioAndAsset(portfolio.id, asset.id)
      ).resolves.toEqual(expect.objectContaining({ id: holding.id }));
      await expect(
        holdingRepository.findByPortfolioAndAsset(portfolio.id, uuid(255))
      ).resolves.toBeNull();
    });

    it('should list the owning users holdings with relations, oldest first, filtered by portfolio', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const other = await seedUser('owner-b@test.com', 'ownerb');
      const asset = await seedAsset();
      const ether = await seedAsset({
        coinGeckoId: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        currentPrice: '3000'
      });
      const portfolioA = await seedPortfolio(owner.id, { name: 'Portfolio A' });
      const portfolioB = await seedPortfolio(owner.id, { name: 'Portfolio B' });

      const first = await seedHolding(owner, portfolioA, asset, {
        amount: '1',
        notes: 'First'
      });
      const second = await seedHolding(owner, portfolioB, asset, {
        amount: '2',
        notes: 'Second'
      });
      await seedHolding(other, portfolioA, ether, { amount: '3' });

      await setCreatedAt(
        'holding',
        first.id,
        new Date('2026-01-01T00:00:00.000Z')
      );
      await setCreatedAt(
        'holding',
        second.id,
        new Date('2026-02-01T00:00:00.000Z')
      );

      const all = await holdingRepository.listByUser(owner.id, {});
      expect(all.map((item) => item.id)).toEqual([first.id, second.id]);
      expect(all[0].asset.symbol).toBe('btc');
      expect(all[0].portfolio.name).toBe('Portfolio A');

      const filtered = await holdingRepository.listByUser(owner.id, {
        portfolioId: portfolioB.id
      });
      expect(filtered.map((item) => item.id)).toEqual([second.id]);

      const foreign = await holdingRepository.listByUser(other.id, {});
      expect(foreign.map((item) => item.id)).toEqual([expect.any(String)]);
    });

    it('should list holdings for valuation scoped to a portfolio with the asset relation', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const btc = await seedAsset();
      const eth = await seedAsset({
        coinGeckoId: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        currentPrice: '3000'
      });
      const portfolio = await seedPortfolio(owner.id);
      const otherPortfolio = await seedPortfolio(owner.id, { name: 'Other' });

      const first = await seedHolding(owner, portfolio, btc, {
        amount: '1',
        notes: null
      });
      const second = await seedHolding(owner, portfolio, eth, {
        amount: '2',
        notes: null
      });
      await seedHolding(owner, otherPortfolio, eth, { amount: '3' });

      await setCreatedAt(
        'holding',
        first.id,
        new Date('2026-01-01T00:00:00.000Z')
      );
      await setCreatedAt(
        'holding',
        second.id,
        new Date('2026-02-01T00:00:00.000Z')
      );

      const result = await holdingRepository.listForValuation(portfolio.id);

      expect(result.map((item) => item.id)).toEqual([first.id, second.id]);
      expect(result.map((item) => item.asset.symbol)).toEqual(['btc', 'eth']);
    });

    it('should update a holding only when it belongs to the user', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const other = await seedUser('owner-b@test.com', 'ownerb');
      const asset = await seedAsset();
      const portfolio = await seedPortfolio(owner.id);
      const holding = await seedHolding(owner, portfolio, asset, {
        amount: '1.5',
        notes: null
      });

      const updated = await holdingRepository.update(holding.id, owner.id, {
        amount: '2.5',
        notes: 'Updated'
      });
      expect(updated?.amount).toBe('2.500000000000000000');
      expect(updated?.notes).toBe('Updated');

      const foreign = await holdingRepository.update(holding.id, other.id, {
        amount: '9'
      });
      expect(foreign).toBeNull();

      const persisted = await holdingRepository.findByIdAndUser(
        holding.id,
        owner.id
      );
      expect(persisted?.amount).toBe('2.500000000000000000');
    });

    it('should delete a holding only when it belongs to the user', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const other = await seedUser('owner-b@test.com', 'ownerb');
      const asset = await seedAsset();
      const portfolio = await seedPortfolio(owner.id);
      const holding = await seedHolding(owner, portfolio, asset);

      await expect(
        holdingRepository.delete(holding.id, other.id)
      ).resolves.toBe(false);
      await expect(
        holdingRepository.delete(holding.id, owner.id)
      ).resolves.toBe(true);
      await expect(
        holdingRepository.delete(holding.id, owner.id)
      ).resolves.toBe(false);
    });
  });

  describe('PortfolioTransactionRepository', () => {
    it('should create and return a transaction with the supplied decimal values', async () => {
      const user = await seedUser('owner-a@test.com', 'ownera');
      const asset = await seedAsset();
      const portfolio = await seedPortfolio(user.id);
      const occurredAt = new Date('2026-07-28T08:00:00.000Z');

      const transaction = await transactionRepository.create({
        userId: user.id,
        portfolioId: portfolio.id,
        assetId: asset.id,
        type: PortfolioTransactionType.BUY,
        amount: '0.5',
        price: '60000.50',
        fee: '0.75',
        occurredAt,
        notes: 'Dollar-cost average'
      });

      expect(transaction).toMatchObject({
        id: expect.any(String),
        userId: user.id,
        portfolioId: portfolio.id,
        assetId: asset.id,
        type: PortfolioTransactionType.BUY,
        amount: '0.5',
        price: '60000.50',
        fee: '0.75',
        occurredAt: expect.any(Date),
        notes: 'Dollar-cost average'
      });
    });

    it('should find a transaction with its asset and portfolio only for the owning user', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const other = await seedUser('owner-b@test.com', 'ownerb');
      const asset = await seedAsset();
      const portfolio = await seedPortfolio(owner.id);
      const transaction = await seedTransaction(owner, portfolio, asset);

      const found = await transactionRepository.findByIdAndPortfolioAndUser(
        transaction.id,
        portfolio.id,
        owner.id
      );

      expect(found).toMatchObject({
        id: transaction.id,
        asset: { id: asset.id, symbol: 'btc', name: 'Bitcoin' },
        portfolio: { id: portfolio.id, name: 'My Ledger' }
      });
      await expect(
        transactionRepository.findByIdAndPortfolioAndUser(
          transaction.id,
          portfolio.id,
          other.id
        )
      ).resolves.toBeNull();
    });

    it('should list newest first and filter by type, asset, and time window', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const btc = await seedAsset();
      const eth = await seedAsset({
        coinGeckoId: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        currentPrice: '3000'
      });
      const portfolio = await seedPortfolio(owner.id);

      await seedTransaction(owner, portfolio, btc, {
        type: PortfolioTransactionType.BUY,
        amount: '0.5',
        price: '60000',
        occurredAt: new Date('2026-07-01T08:00:00.000Z')
      });
      await seedTransaction(owner, portfolio, eth, {
        type: PortfolioTransactionType.BUY,
        amount: '2',
        price: '3000',
        occurredAt: new Date('2026-07-02T08:00:00.000Z')
      });
      await seedTransaction(owner, portfolio, btc, {
        type: PortfolioTransactionType.SELL,
        amount: '0.2',
        price: '61000',
        occurredAt: new Date('2026-07-03T08:00:00.000Z')
      });

      const all = await transactionRepository.listByPortfolioAndUser({
        userId: owner.id,
        portfolioId: portfolio.id,
        limit: 100
      });
      expect(all.map((item) => item.type)).toEqual([
        PortfolioTransactionType.SELL,
        PortfolioTransactionType.BUY,
        PortfolioTransactionType.BUY
      ]);

      const byType = await transactionRepository.listByPortfolioAndUser({
        userId: owner.id,
        portfolioId: portfolio.id,
        type: PortfolioTransactionType.SELL,
        limit: 100
      });
      expect(byType).toHaveLength(1);
      expect(byType[0].assetId).toBe(btc.id);

      const byAsset = await transactionRepository.listByPortfolioAndUser({
        userId: owner.id,
        portfolioId: portfolio.id,
        assetId: eth.id,
        limit: 100
      });
      expect(byAsset).toHaveLength(1);
      expect(byAsset[0].assetId).toBe(eth.id);

      const byWindow = await transactionRepository.listByPortfolioAndUser({
        userId: owner.id,
        portfolioId: portfolio.id,
        from: new Date('2026-07-02T00:00:00.000Z'),
        to: new Date('2026-07-02T23:59:59.999Z'),
        limit: 100
      });
      expect(byWindow).toHaveLength(1);
      expect(byWindow[0].assetId).toBe(eth.id);
    });

    it('should paginate with a keyset cursor breaking ties by id, both descending', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const asset = await seedAsset();
      const portfolio = await seedPortfolio(owner.id);
      const occurredAt = new Date('2026-07-28T08:00:00.000Z');

      await seedTransaction(owner, portfolio, asset, {
        id: uuid(1),
        occurredAt
      });
      await seedTransaction(owner, portfolio, asset, {
        id: uuid(2),
        occurredAt
      });
      await seedTransaction(owner, portfolio, asset, {
        id: uuid(3),
        occurredAt
      });

      const firstPage = await transactionRepository.listByPortfolioAndUser({
        userId: owner.id,
        portfolioId: portfolio.id,
        limit: 2,
        cursor: null
      });
      expect(firstPage.map((item) => item.id)).toEqual([uuid(3), uuid(2)]);

      const secondPage = await transactionRepository.listByPortfolioAndUser({
        userId: owner.id,
        portfolioId: portfolio.id,
        limit: 2,
        cursor: { occurredAt, id: uuid(2) }
      });
      expect(secondPage.map((item) => item.id)).toEqual([uuid(1)]);
    });

    it('should respect the limit', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const asset = await seedAsset();
      const portfolio = await seedPortfolio(owner.id);

      for (let index = 0; index < 3; index += 1) {
        await seedTransaction(owner, portfolio, asset, {
          occurredAt: new Date(`2026-07-0${index + 1}T08:00:00.000Z`)
        });
      }

      const result = await transactionRepository.listByPortfolioAndUser({
        userId: owner.id,
        portfolioId: portfolio.id,
        limit: 2
      });

      expect(result).toHaveLength(2);
    });

    it('should list the full chronological ledger for P&L with assets and ownership scoping', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const other = await seedUser('owner-b@test.com', 'ownerb');
      const btc = await seedAsset();
      const eth = await seedAsset({
        coinGeckoId: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        currentPrice: '3000'
      });
      const portfolio = await seedPortfolio(owner.id);

      await seedTransaction(owner, portfolio, btc, {
        id: uuid(1),
        type: PortfolioTransactionType.TRANSFER_IN,
        price: null,
        occurredAt: new Date('2026-07-02T08:00:00.000Z')
      });
      await seedTransaction(owner, portfolio, eth, {
        id: uuid(2),
        type: PortfolioTransactionType.BUY,
        amount: '2',
        price: '3000',
        occurredAt: new Date('2026-07-01T08:00:00.000Z')
      });
      await seedTransaction(other, portfolio, btc, {
        id: uuid(3),
        type: PortfolioTransactionType.BUY,
        occurredAt: new Date('2026-06-01T08:00:00.000Z')
      });

      const result = await transactionRepository.listForPnl(
        portfolio.id,
        owner.id
      );

      expect(result.map((item) => item.id)).toEqual([uuid(2), uuid(1)]);
      expect(result[0].asset.symbol).toBe('eth');
      expect(result[1].asset.symbol).toBe('btc');

      const foreign = await transactionRepository.listForPnl(
        portfolio.id,
        other.id
      );
      expect(foreign).toHaveLength(1);
      expect(foreign[0].id).toBe(uuid(3));
    });

    it('should update a transaction only when it belongs to the user and portfolio', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const other = await seedUser('owner-b@test.com', 'ownerb');
      const asset = await seedAsset();
      const portfolio = await seedPortfolio(owner.id);
      const transaction = await seedTransaction(owner, portfolio, asset);

      const updated = await transactionRepository.update(
        transaction.id,
        portfolio.id,
        owner.id,
        { amount: '2', price: '65000', notes: 'Updated' }
      );
      expect(updated?.amount).toBe('2.000000000000000000');
      expect(updated?.price).toBe('65000.00000000');
      expect(updated?.notes).toBe('Updated');

      const foreign = await transactionRepository.update(
        transaction.id,
        portfolio.id,
        other.id,
        { amount: '9' }
      );
      expect(foreign).toBeNull();

      const persisted = await transactionRepository.findByIdAndPortfolioAndUser(
        transaction.id,
        portfolio.id,
        owner.id
      );
      expect(persisted?.amount).toBe('2.000000000000000000');
    });

    it('should delete a transaction only when it belongs to the user and portfolio', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const other = await seedUser('owner-b@test.com', 'ownerb');
      const asset = await seedAsset();
      const portfolio = await seedPortfolio(owner.id);
      const transaction = await seedTransaction(owner, portfolio, asset);

      await expect(
        transactionRepository.deleteByIdAndPortfolioAndUser(
          transaction.id,
          portfolio.id,
          other.id
        )
      ).resolves.toBe(false);
      await expect(
        transactionRepository.deleteByIdAndPortfolioAndUser(
          transaction.id,
          portfolio.id,
          owner.id
        )
      ).resolves.toBe(true);
      await expect(
        transactionRepository.deleteByIdAndPortfolioAndUser(
          transaction.id,
          portfolio.id,
          owner.id
        )
      ).resolves.toBe(false);
    });
  });

  describe('PortfolioOpeningBalanceRepository', () => {
    it('should upsert a new opening balance with asset and portfolio relations', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const asset = await seedAsset();
      const portfolio = await seedPortfolio(owner.id);

      const created = await openingBalanceRepository.upsert({
        userId: owner.id,
        portfolioId: portfolio.id,
        assetId: asset.id,
        openingQuantity: '1',
        openingCost: '90000'
      });

      expect(created).toMatchObject({
        id: expect.any(String),
        portfolioId: portfolio.id,
        assetId: asset.id,
        openingQuantity: '1.000000000000000000',
        openingCost: '90000.00000000000000000000000000',
        asset: { id: asset.id, symbol: 'btc', name: 'Bitcoin' },
        portfolio: { id: portfolio.id, name: 'My Ledger' }
      });
    });

    it('should update the existing balance for the same portfolio and asset', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const asset = await seedAsset();
      const portfolio = await seedPortfolio(owner.id);

      const created = await openingBalanceRepository.upsert({
        userId: owner.id,
        portfolioId: portfolio.id,
        assetId: asset.id,
        openingQuantity: '1',
        openingCost: '90000'
      });

      const updated = await openingBalanceRepository.upsert({
        userId: owner.id,
        portfolioId: portfolio.id,
        assetId: asset.id,
        openingQuantity: '2',
        openingCost: '180000'
      });

      expect(updated.id).toBe(created.id);
      expect(updated.openingQuantity).toBe('2.000000000000000000');
      expect(updated.openingCost).toBe('180000.00000000000000000000000000');

      const count = await dataSource
        .getRepository(PortfolioOpeningBalance)
        .count({
          where: { portfolioId: portfolio.id, assetId: asset.id }
        });
      expect(count).toBe(1);
    });

    it('should list opening balances by portfolio and user, oldest first, with relations', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const other = await seedUser('owner-b@test.com', 'ownerb');
      const btc = await seedAsset({ id: uuid(1) });
      const eth = await seedAsset({
        id: uuid(2),
        coinGeckoId: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        currentPrice: '3000'
      });
      const sol = await seedAsset({
        id: uuid(3),
        coinGeckoId: 'solana',
        symbol: 'sol',
        name: 'Solana',
        currentPrice: '150'
      });
      const portfolio = await seedPortfolio(owner.id);

      const second = await openingBalanceRepository.upsert({
        userId: owner.id,
        portfolioId: portfolio.id,
        assetId: eth.id,
        openingQuantity: '2',
        openingCost: '6000'
      });
      const first = await openingBalanceRepository.upsert({
        userId: owner.id,
        portfolioId: portfolio.id,
        assetId: btc.id,
        openingQuantity: '1',
        openingCost: '90000'
      });
      await openingBalanceRepository.upsert({
        userId: other.id,
        portfolioId: portfolio.id,
        assetId: sol.id,
        openingQuantity: '3',
        openingCost: '450'
      });

      await setCreatedAt(
        'portfolio_opening_balance',
        first.id,
        new Date('2026-01-01T00:00:00.000Z')
      );
      await setCreatedAt(
        'portfolio_opening_balance',
        second.id,
        new Date('2026-02-01T00:00:00.000Z')
      );

      const result = await openingBalanceRepository.listByPortfolioAndUser(
        portfolio.id,
        owner.id
      );

      expect(result.map((item) => item.assetId)).toEqual([btc.id, eth.id]);
      expect(result[0].asset.symbol).toBe('btc');
      expect(result[0].portfolio.name).toBe('My Ledger');

      const foreign = await openingBalanceRepository.listByPortfolioAndUser(
        portfolio.id,
        other.id
      );
      expect(foreign.map((item) => item.assetId)).toEqual([sol.id]);
    });

    it('should list opening balances for P&L ordered by assetId with the asset relation', async () => {
      const owner = await seedUser('owner-a@test.com', 'ownera');
      const btc = await seedAsset({ id: uuid(1) });
      const eth = await seedAsset({
        id: uuid(2),
        coinGeckoId: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        currentPrice: '3000'
      });
      const portfolio = await seedPortfolio(owner.id);

      await openingBalanceRepository.upsert({
        userId: owner.id,
        portfolioId: portfolio.id,
        assetId: btc.id,
        openingQuantity: '1',
        openingCost: '90000'
      });
      await openingBalanceRepository.upsert({
        userId: owner.id,
        portfolioId: portfolio.id,
        assetId: eth.id,
        openingQuantity: '2',
        openingCost: '6000'
      });

      const result = await openingBalanceRepository.listForPnl(
        portfolio.id,
        owner.id
      );

      expect(result.map((item) => item.assetId)).toEqual([btc.id, eth.id]);
      expect(result.every((item) => item.asset.id === item.assetId)).toBe(true);
    });
  });

  async function seedUser(email: string, username: string): Promise<User> {
    const repository = dataSource.getRepository(User);

    return repository.save(
      repository.create({
        email,
        username,
        password: 'unused-by-repository-tests',
        name: null,
        role: UserRole.USER,
        status: UserStatus.ACTIVATE
      })
    );
  }

  async function seedAsset(overrides: Partial<Asset> = {}): Promise<Asset> {
    const now = new Date('2026-07-28T08:00:00.000Z');

    return dataSource.getRepository(Asset).save({
      coinGeckoId: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      imageUrl: null,
      currentPrice: '60000',
      marketCap: '1200000000000',
      marketCapRank: 1,
      totalVolume: '30000000000',
      circulatingSupply: '19000000',
      totalSupply: '21000000',
      maxSupply: '21000000',
      priceChange24h: '500',
      priceChangePercentage24h: '0.8',
      lastSyncedAt: now,
      ...overrides
    });
  }

  async function seedPortfolio(
    userId: string,
    overrides: Partial<Portfolio> = {}
  ): Promise<Portfolio> {
    return portfolioRepository.create({
      userId,
      name: 'My Ledger',
      sourceType: PortfolioSourceType.WALLET,
      walletAddress: null,
      ...overrides
    });
  }

  async function seedHolding(
    user: User,
    portfolio: Portfolio,
    asset: Asset,
    overrides: Partial<Holding> = {}
  ): Promise<Holding> {
    return holdingRepository.create({
      userId: user.id,
      portfolioId: portfolio.id,
      assetId: asset.id,
      amount: '1.5',
      notes: null,
      ...overrides
    });
  }

  async function seedTransaction(
    user: User,
    portfolio: Portfolio,
    asset: Asset,
    overrides: Partial<PortfolioTransaction> = {}
  ): Promise<PortfolioTransaction> {
    return transactionRepository.create({
      userId: user.id,
      portfolioId: portfolio.id,
      assetId: asset.id,
      type: PortfolioTransactionType.BUY,
      amount: '1.5',
      price: '60000',
      fee: null,
      occurredAt: new Date('2026-07-28T08:00:00.000Z'),
      notes: null,
      ...overrides
    });
  }

  async function setCreatedAt(
    table: string,
    id: string,
    createdAt: Date
  ): Promise<void> {
    await dataSource.query(
      `UPDATE "${table}" SET "createdAt" = $1 WHERE "id" = $2`,
      [createdAt, id]
    );
  }

  function uuid(index: number): string {
    return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  }
});
