import {
  MARKET_DATA_PORT,
  MarketDataEntry,
  MarketDataPort
} from '@features/assets/application/interfaces/assets.interface';
import { Asset } from '@features/assets/domain/entities/asset.entity';
import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

describe('Assets (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const marketDataFixtures: MarketDataEntry[] = [
    {
      coinGeckoId: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      imageUrl: 'https://example.test/bitcoin.png',
      currentPrice: '96785.25',
      marketCap: '1912345678901.23',
      marketCapRank: 1,
      totalVolume: '48210987654.32',
      circulatingSupply: '19758964',
      totalSupply: '21000000',
      maxSupply: '21000000',
      priceChange24h: '1524.1',
      priceChangePercentage24h: '1.6032'
    },
    {
      coinGeckoId: 'ethereum',
      symbol: 'eth',
      name: 'Ethereum',
      imageUrl: null,
      currentPrice: '3456.78',
      marketCap: '416000000000',
      marketCapRank: 2,
      totalVolume: '15000000000',
      circulatingSupply: '120000000',
      totalSupply: '120000000',
      maxSupply: null,
      priceChange24h: '-45.22',
      priceChangePercentage24h: '-1.29'
    }
  ];

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

  function mutationHeaders(context: AuthenticatedUserContext) {
    return {
      'X-CSRF-Token': context.response.headers.xCsrfToken
    };
  }

  async function seedAssets(): Promise<Asset[]> {
    const now = new Date('2026-07-28T08:00:00.000Z');

    return dataSource.getRepository(Asset).save([
      {
        coinGeckoId: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        imageUrl: 'https://example.test/bitcoin.png',
        currentPrice: '96785.25000000',
        marketCap: '1912345678901.23',
        marketCapRank: 1,
        totalVolume: '48210987654.32',
        circulatingSupply: '19758964.00000000',
        totalSupply: '21000000.00000000',
        maxSupply: '21000000.00000000',
        priceChange24h: '1524.10000000',
        priceChangePercentage24h: '1.6032',
        lastSyncedAt: now
      },
      {
        coinGeckoId: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        imageUrl: 'https://example.test/ethereum.png',
        currentPrice: '3456.78000000',
        marketCap: '416000000000.00',
        marketCapRank: 2,
        totalVolume: '15000000000.00',
        circulatingSupply: '120000000.00000000',
        totalSupply: '120000000.00000000',
        maxSupply: null,
        priceChange24h: '-45.22000000',
        priceChangePercentage24h: '-1.2900',
        lastSyncedAt: now
      },
      {
        coinGeckoId: 'bitcoin-cash',
        symbol: 'bch',
        name: 'Bitcoin Cash',
        imageUrl: null,
        currentPrice: null,
        marketCap: null,
        marketCapRank: null,
        totalVolume: null,
        circulatingSupply: null,
        totalSupply: null,
        maxSupply: null,
        priceChange24h: null,
        priceChangePercentage24h: null,
        lastSyncedAt: now
      }
    ]);
  }

  describe('GET /v1/assets', () => {
    it('should require authentication', async () => {
      const client = new ApiClient(app);

      const response = await client.get('/v1/assets');

      expect(response.status).toBe(401);
    });

    it('should list assets for authenticated user', async () => {
      await seedAssets();
      const { client } = await AuthFactory.authenticated(app);

      const response = await client.get('/v1/assets');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(3);
      expect(response.body.nextCursor).toBeNull();

      const bitcoin = response.body.items.find(
        (asset: Asset) => asset.coinGeckoId === 'bitcoin'
      );

      expect(bitcoin).toMatchObject({
        coinGeckoId: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        imageUrl: 'https://example.test/bitcoin.png',
        marketCapRank: 1
      });
      expect(bitcoin.id).toEqual(expect.any(String));
      expect(bitcoin.lastSyncedAt).toEqual(expect.any(String));
      expect(bitcoin.createdAt).toEqual(expect.any(String));
      expect(bitcoin.updatedAt).toEqual(expect.any(String));
    });

    it('should paginate and support search', async () => {
      const seeded = await seedAssets();
      const { client } = await AuthFactory.authenticated(app);

      const matches = seeded
        .filter(
          (asset) =>
            asset.name.toLowerCase().includes('bit') ||
            asset.symbol.includes('bit') ||
            asset.coinGeckoId.includes('bit')
        )
        .sort((a, b) => a.id.localeCompare(b.id));

      const firstPage = await client.get('/v1/assets', {
        query: { search: 'bit', limit: 1 }
      });

      expect(firstPage.status).toBe(200);
      expect(firstPage.body.items).toHaveLength(1);
      expect(firstPage.body.items[0].id).toBe(matches[0].id);
      expect(firstPage.body.nextCursor).toEqual(expect.any(String));

      const secondPage = await client.get('/v1/assets', {
        query: {
          search: 'bit',
          limit: 1,
          cursor: firstPage.body.nextCursor
        }
      });

      expect(secondPage.status).toBe(200);
      expect(secondPage.body.items.map((asset: Asset) => asset.id)).toEqual([
        matches[1].id
      ]);
      expect(secondPage.body.nextCursor).toBeNull();
    });

    it('should return empty list when no assets exist', async () => {
      const { client } = await AuthFactory.authenticated(app);

      const response = await client.get('/v1/assets');

      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
      expect(response.body.nextCursor).toBeNull();
    });
  });

  describe('GET /v1/assets/:id', () => {
    it('should require authentication', async () => {
      const client = new ApiClient(app);

      const response = await client.get(
        '/v1/assets/11111111-1111-4111-8111-111111111111'
      );

      expect(response.status).toBe(401);
    });

    it('should return asset by UUID', async () => {
      const [bitcoin] = await seedAssets();
      const { client } = await AuthFactory.authenticated(app);

      const response = await client.get(`/v1/assets/${bitcoin.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: bitcoin.id,
        coinGeckoId: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        imageUrl: 'https://example.test/bitcoin.png',
        currentPrice: '96785.25000000',
        marketCap: '1912345678901.23',
        marketCapRank: 1,
        totalVolume: '48210987654.32',
        circulatingSupply: '19758964.00000000',
        totalSupply: '21000000.00000000',
        maxSupply: '21000000.00000000',
        priceChange24h: '1524.10000000',
        priceChangePercentage24h: '1.6032'
      });
      expect(response.body.lastSyncedAt).toEqual(expect.any(String));
      expect(response.body.createdAt).toEqual(expect.any(String));
      expect(response.body.updatedAt).toEqual(expect.any(String));
      expect(response.body).not.toHaveProperty('deletedAt');
    });

    it('should return 404 for unknown asset', async () => {
      const { client } = await AuthFactory.authenticated(app);

      const response = await client.get(
        '/v1/assets/00000000-0000-4000-8000-000000000000'
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('ASSET_NOT_FOUND');
    });

    it('should return 422 for invalid UUID', async () => {
      const { client } = await AuthFactory.authenticated(app);

      const response = await client.get('/v1/assets/not-a-uuid');

      expect(response.status).toBe(422);
    });
  });

  describe('POST /v1/assets/sync', () => {
    async function waitForAssets(
      expected: number,
      timeoutMs = 8_000
    ): Promise<Asset[]> {
      const repository = dataSource.getRepository(Asset);
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const stored = await repository.find();
        if (stored.length >= expected) {
          return stored;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      throw new Error(`Timed out waiting for ${expected} assets to persist`);
    }

    async function waitForCondition(
      condition: () => boolean | Promise<boolean>,
      message: string,
      timeoutMs = 5_000
    ): Promise<void> {
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        if (await condition()) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      throw new Error(message);
    }

    it('should require authentication', async () => {
      const client = new ApiClient(app);

      const response = await client.post('/v1/assets/sync');

      expect(response.status).toBe(401);
    });

    it('should allow owner to trigger sync and persist provider data', async () => {
      const marketDataPort = app.get<MarketDataPort>(MARKET_DATA_PORT);
      const spy = jest
        .spyOn(marketDataPort, 'fetchMarketData')
        .mockResolvedValue(marketDataFixtures);

      const context = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      const response = await context.client.post('/v1/assets/sync', {
        headers: mutationHeaders(context)
      });

      expect(response.status).toBe(202);
      expect(response.body.jobId).toEqual(expect.any(String));

      const stored = await waitForAssets(2);

      const bitcoin = stored.find((asset) => asset.coinGeckoId === 'bitcoin');
      expect(bitcoin).toMatchObject({
        symbol: 'btc',
        name: 'Bitcoin',
        imageUrl: 'https://example.test/bitcoin.png',
        currentPrice: '96785.25000000',
        marketCapRank: 1
      });
      expect(bitcoin!.lastSyncedAt).toBeInstanceOf(Date);

      const ethereum = stored.find((asset) => asset.coinGeckoId === 'ethereum');
      expect(ethereum).toMatchObject({
        symbol: 'eth',
        name: 'Ethereum',
        imageUrl: null,
        currentPrice: '3456.78000000',
        marketCapRank: 2,
        maxSupply: null
      });

      spy.mockRestore();
    });

    it('should deduplicate a manual sync while one is still in flight', async () => {
      const marketDataPort = app.get<MarketDataPort>(MARKET_DATA_PORT);

      let unblockProvider!: () => void;
      const providerBlocked = new Promise<void>((resolve) => {
        unblockProvider = resolve;
      });

      const spy = jest
        .spyOn(marketDataPort, 'fetchMarketData')
        .mockImplementation(async () => {
          await providerBlocked;
          return marketDataFixtures;
        });

      const context = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      const first = await context.client.post('/v1/assets/sync', {
        headers: mutationHeaders(context)
      });
      expect(first.status).toBe(202);

      await waitForCondition(
        () => spy.mock.calls.length === 1,
        'the worker never picked up the first sync job'
      );

      const second = await context.client.post('/v1/assets/sync', {
        headers: mutationHeaders(context)
      });
      expect(second.status).toBe(202);
      expect(second.body.jobId).toBe(first.body.jobId);

      unblockProvider();
      await waitForAssets(2);

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('should reject admin from triggering sync', async () => {
      const context = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.ADMIN, withPermissions: [Permission.USER_READ] },
        dataSource
      );

      const response = await context.client.post('/v1/assets/sync', {
        headers: mutationHeaders(context)
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });

    it('should reject regular user from triggering sync', async () => {
      const context = await AuthFactory.authenticated(app);

      const response = await context.client.post('/v1/assets/sync', {
        headers: mutationHeaders(context)
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });
  });
});
