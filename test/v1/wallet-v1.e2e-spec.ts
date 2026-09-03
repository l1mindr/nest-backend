import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

describe('Wallet (e2e) version: 1', () => {
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

  function mutationHeaders(context: AuthenticatedUserContext) {
    return { 'X-CSRF-Token': context.response.headers.xCsrfToken };
  }

  describe('POST /v1/wallets', () => {
    it('should require authentication', async () => {
      const client = new ApiClient(app);

      const response = await client.post('/v1/wallets', {
        body: { name: 'MetaMask' }
      });

      expect(response.status).toBe(401);
    });

    it('should register a wallet with just a name', async () => {
      const auth = await AuthFactory.authenticated(app);

      const response = await auth.client.post('/v1/wallets', {
        body: { name: 'MetaMask' },
        headers: mutationHeaders(auth)
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'MetaMask',
        address: null
      });
      expect(response.body.id).toEqual(expect.any(String));
      expect(response.body).not.toHaveProperty('userId');
    });

    it('should register a wallet with an address', async () => {
      const auth = await AuthFactory.authenticated(app);

      const response = await auth.client.post('/v1/wallets', {
        body: {
          name: 'Ledger',
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
        },
        headers: mutationHeaders(auth)
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'Ledger',
        address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
      });
    });

    it('should reject a missing name', async () => {
      const auth = await AuthFactory.authenticated(app);

      const response = await auth.client.post('/v1/wallets', {
        body: {},
        headers: mutationHeaders(auth)
      });

      expect(response.status).toBe(422);
    });
  });

  describe('GET /v1/wallets', () => {
    it('should require authentication', async () => {
      const client = new ApiClient(app);

      const response = await client.get('/v1/wallets');

      expect(response.status).toBe(401);
    });

    it('should return only the authenticated user wallets, newest first', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'walletsA@test.com', username: 'walletsa' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'walletsB@test.com', username: 'walletsb' }
      });

      await userA.client.post('/v1/wallets', {
        body: { name: 'MetaMask' },
        headers: mutationHeaders(userA)
      });
      await userA.client.post('/v1/wallets', {
        body: { name: 'Ledger' },
        headers: mutationHeaders(userA)
      });
      await userB.client.post('/v1/wallets', {
        body: { name: 'Trust Wallet' },
        headers: mutationHeaders(userB)
      });

      const response = await userA.client.get('/v1/wallets');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body.map((w: { name: string }) => w.name)).toEqual([
        'Ledger',
        'MetaMask'
      ]);
    });

    it('should return an empty list for a user with no wallets', async () => {
      const auth = await AuthFactory.authenticated(app);

      const response = await auth.client.get('/v1/wallets');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
});
