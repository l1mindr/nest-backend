import { Asset } from '@features/assets/domain/entities/asset.entity';
import { INestApplication } from '@nestjs/common';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { getCookie, normalizeHeader } from '../utils/cookie.util';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

describe('Realtime WebSocket (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;
  const openSockets: Socket[] = [];

  beforeAll(async () => {
    const context = await createMigratedTestApp();
    app = context.app;
    dataSource = context.dataSource;

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
  });

  afterEach(() => {
    while (openSockets.length > 0) {
      openSockets.pop()?.disconnect();
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  function mutationHeaders(ctx: AuthenticatedUserContext) {
    return { 'X-CSRF-Token': ctx.response.headers.xCsrfToken };
  }

  function accessTokenCookie(ctx: AuthenticatedUserContext): string {
    const cookies = normalizeHeader(ctx.response.login.headers['set-cookie']);
    return getCookie(cookies, 'access_token');
  }

  function connectSocket(cookie?: string): Socket {
    const socket = io(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      extraHeaders: cookie ? { Cookie: cookie } : undefined
    });
    openSockets.push(socket);
    return socket;
  }

  function waitForEvent<T = unknown>(
    socket: Socket,
    event: string
  ): Promise<T> {
    return new Promise((resolve) => socket.once(event, resolve));
  }

  async function seedAsset(): Promise<Asset> {
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
      lastSyncedAt: new Date('2026-07-28T08:00:00.000Z')
    });
  }

  async function createPortfolio(auth: AuthenticatedUserContext) {
    const response = await auth.client.post('/v1/portfolios', {
      body: { name: 'My Ledger', sourceType: 'WALLET' },
      headers: mutationHeaders(auth)
    });

    expect(response.status).toBe(201);

    return response.body as { id: string };
  }

  describe('Authentication', () => {
    it('rejects a connection with no access_token cookie', async () => {
      const socket = connectSocket();

      const [reason] = await waitForEvent<[string]>(socket, 'disconnect');

      expect(reason).toBeDefined();
      expect(socket.connected).toBe(false);
    });

    it('rejects a connection with a garbage access_token cookie', async () => {
      const socket = connectSocket('access_token=not-a-real-token');

      await waitForEvent(socket, 'disconnect');

      expect(socket.connected).toBe(false);
    });

    it('accepts a connection with a valid access_token cookie', async () => {
      const auth = await AuthFactory.authenticated(app, {});
      const socket = connectSocket(accessTokenCookie(auth));

      await waitForEvent(socket, 'connect');

      // Give a rejected connection's disconnect a moment to have fired if it
      // were going to; a valid session must stay connected past that window.
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(socket.connected).toBe(true);
    });
  });

  describe('Cross-user isolation', () => {
    it('only delivers transaction.created to the owning user', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'userA@test.com', username: 'userA' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'userB@test.com', username: 'userB' }
      });
      const asset = await seedAsset();
      const portfolio = await createPortfolio(userA);

      const socketA = connectSocket(accessTokenCookie(userA));
      const socketB = connectSocket(accessTokenCookie(userB));

      await Promise.all([
        waitForEvent(socketA, 'connect'),
        waitForEvent(socketB, 'connect')
      ]);

      let userBReceivedEvent = false;
      socketB.on('transaction.created', () => {
        userBReceivedEvent = true;
      });

      const eventPromise = waitForEvent<{
        portfolioId: string;
        transactionId: string;
      }>(socketA, 'transaction.created');

      const response = await userA.client.post(
        `/v1/portfolios/${portfolio.id}/transactions`,
        {
          body: {
            assetId: asset.id,
            type: 'BUY',
            amount: '1.5',
            price: '60000',
            occurredAt: '2026-07-28T08:00:00.000Z'
          },
          headers: mutationHeaders(userA)
        }
      );

      expect(response.status).toBe(201);

      const payload = await eventPromise;
      expect(payload.portfolioId).toBe(portfolio.id);
      expect(payload.transactionId).toBe(response.body.id);

      // The event is emitted synchronously to both rooms; give user B's
      // socket the same window to (not) receive it.
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(userBReceivedEvent).toBe(false);
    });
  });

  describe('Session revocation', () => {
    it('disconnects the socket immediately when its session is revoked', async () => {
      const auth = await AuthFactory.authenticated(app, {});
      const socket = connectSocket(accessTokenCookie(auth));

      await waitForEvent(socket, 'connect');

      const disconnectPromise = waitForEvent(socket, 'disconnect');

      const response = await auth.client.delete('/v1/sessions', {
        headers: mutationHeaders(auth)
      });

      expect(response.status).toBe(204);

      await disconnectPromise;
      expect(socket.connected).toBe(false);
    });
  });
});
