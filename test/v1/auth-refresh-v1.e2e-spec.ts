import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { runMigrations, truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
// import { getCookie, normalizeHeader } from '../utils/cookie.util';

describe('Auth Refresh (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } = await createTestApp();
    await runMigrations(testDataSource);

    app = testApp;
    dataSource = testDataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should refresh token successfully', async () => {
    const {
      response: {
        cookies: { refreshToken, csrfToken },
        headers: { xCsrfToken }
      }
    } = await AuthFactory.authenticated(app, {
      loginBy: 'email'
    });

    const res = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', `${refreshToken}; ${csrfToken}`)
      .set('X-CSRF-Token', xCsrfToken);

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toContain('access_token');
    expect(res.headers['set-cookie'][1]).toContain('refresh_token');
    expect(res.headers['set-cookie'][2]).toContain('csrf_token');
  });

  it('should detect refresh token reuse', async () => {
    const {
      response: {
        cookies: { refreshToken, csrfToken },
        headers: { xCsrfToken }
      }
    } = await AuthFactory.authenticated(app, {
      loginBy: 'email'
    });

    const firstRefresh = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', `${refreshToken}; ${csrfToken}`)
      .set('X-CSRF-Token', xCsrfToken);

    expect(firstRefresh.status).toBe(200);

    const reuseAttempt = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', `${refreshToken}; ${csrfToken}`)
      .set('X-CSRF-Token', xCsrfToken);

    expect(reuseAttempt.status).toBe(401);
  });

  it('should block concurrent refresh requests', async () => {
    const {
      response: {
        cookies: { refreshToken, csrfToken },
        headers: { xCsrfToken }
      }
    } = await AuthFactory.authenticated(app, {
      loginBy: 'email'
    });

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', `${refreshToken}; ${csrfToken}`)
        .set('X-CSRF-Token', xCsrfToken),

      request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', `${refreshToken}; ${csrfToken}`)
        .set('X-CSRF-Token', xCsrfToken)
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);

    expect(
      JSON.stringify(statuses) === JSON.stringify([200, 401]) ||
        JSON.stringify(statuses) === JSON.stringify([200, 429])
    ).toBe(true);
  });
});
