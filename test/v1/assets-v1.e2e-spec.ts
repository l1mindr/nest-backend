import {
  COINGECKO_PORT,
  CoinGeckoMarketData,
  CoinGeckoPort
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

  const marketDataFixtures: CoinGeckoMarketData[] = [
    {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      image: 'https://example.test/bitcoin.png',
      current_price: 96785.25,
      market_cap: 1912345678901.23,
      market_cap_rank: 1,
      total_volume: 48210987654.32,
      circulating_supply: 19758964,
      total_supply: 21000000,
      max_supply: 21000000,
      price_change_24h: 1524.1,
      price_change_percentage_24h: 1.6032
    },
    {
      id: 'ethereum',
      symbol: 'eth',
      name: 'Ethereum',
      current_price: 3456.78,
      market_cap: 416000000000,
      market_cap_rank: 2,
      total_volume: 15000000000,
      circulating_supply: 120000000,
      total_supply: 120000000,
      price_change_24h: -45.22,
      price_change_percentage_24h: -1.29
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
    it('should require authentication', async () => {
      const client = new ApiClient(app);

      const response = await client.post('/v1/assets/sync');

      expect(response.status).toBe(401);
    });

    it('should allow owner to trigger sync', async () => {
      const coingeckoPort = app.get<CoinGeckoPort>(COINGECKO_PORT);
      const spy = jest
        .spyOn(coingeckoPort, 'fetchMarketData')
        .mockResolvedValue(marketDataFixtures);

      const context = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      const response = await context.client.post('/v1/assets/sync', {
        headers: mutationHeaders(context)
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        receivedCount: 2,
        synchronizedCount: 2
      });

      const stored = await dataSource.getRepository(Asset).find();
      expect(stored).toHaveLength(2);

      const bitcoin = stored.find((a) => a.coinGeckoId === 'bitcoin');
      expect(bitcoin).toMatchObject({
        symbol: 'btc',
        name: 'Bitcoin',
        imageUrl: 'https://example.test/bitcoin.png',
        marketCapRank: 1
      });
      expect(bitcoin!.lastSyncedAt).toBeInstanceOf(Date);

      const ethereum = stored.find((a) => a.coinGeckoId === 'ethereum');
      expect(ethereum).toMatchObject({
        symbol: 'eth',
        name: 'Ethereum',
        imageUrl: null,
        marketCapRank: 2,
        maxSupply: null
      });

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
