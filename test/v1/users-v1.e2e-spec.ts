import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

describe('Users (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } =
      await createMigratedTestApp();

    app = testApp;
    dataSource = testDataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('should get current user profile', async () => {
    const { client } = await AuthFactory.authenticated(app, {});
    const res = await client.get('/v1/user/me');

    expect(res.status).toBe(200);
    expect(res.body.email).toBeDefined();
    expect(res.body.username).toBeDefined();
    expect(res.body.role).toBeDefined();
    expect(res.body.joinedAt).toBeDefined();
  });

  it('should fail if user is not authenticated', async () => {
    const client = new ApiClient(app);
    const res = await client.get('/v1/user/me');

    expect(res.status).toBe(401);
  });

  it('should update profile', async () => {
    const {
      client,
      response: {
        cookies: { refreshToken, csrfToken },
        headers: { xCsrfToken }
      }
    } = await AuthFactory.authenticated(app, {});
    const res = await client
      .put('/v1/user', {
        body: {
          name: 'New name'
        }
      })
      .set('Cookie', `${refreshToken}; ${csrfToken}`)
      .set('X-CSRF-Token', xCsrfToken);

    const updateUserDataRes = await client.get('/v1/user/me');

    expect(res.status).toBe(204);
    expect(updateUserDataRes.body.name).toBe('New name');
  });

  it.each([
    { field: 'status', payload: { status: 'ACTIVATE' } },
    { field: 'email', payload: { email: 'new@example.com' } },
    { field: 'username', payload: { username: 'newusername' } }
  ])(
    'should reject profile update with non-whitelisted $field',
    async ({ payload }) => {
      const {
        client,
        response: {
          cookies: { refreshToken, csrfToken },
          headers: { xCsrfToken }
        }
      } = await AuthFactory.authenticated(app, {});
      const res = await client
        .put('/v1/user', {
          body: payload
        })
        .set('Cookie', `${refreshToken}; ${csrfToken}`)
        .set('X-CSRF-Token', xCsrfToken);

      expect(res.status).toBe(422);
    }
  );
});
