import { Session } from '@features/sessions/entities/session.entity';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { runMigrations, truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import {
  getCookie,
  getCookieValue,
  normalizeHeader
} from '../utils/cookie.util';

type RefreshCredentials = {
  refreshCookie: string;
  csrfCookie: string;
  csrfHeader: string;
};

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

  const readCredentials = (
    setCookieHeader: string | string[] | undefined
  ): RefreshCredentials => {
    const cookies = normalizeHeader(setCookieHeader);

    return {
      refreshCookie: getCookie(cookies, 'refresh_token'),
      csrfCookie: getCookie(cookies, 'csrf_token'),
      csrfHeader: getCookieValue(cookies, 'csrf_token')
    };
  };

  const refresh = (credentials: RefreshCredentials) =>
    request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', `${credentials.refreshCookie}; ${credentials.csrfCookie}`)
      .set('X-CSRF-Token', credentials.csrfHeader);

  const authenticate = async (): Promise<RefreshCredentials> => {
    const {
      response: {
        cookies: { refreshToken, csrfToken },
        headers: { xCsrfToken }
      }
    } = await AuthFactory.authenticated(app, { loginBy: 'email' });

    return {
      refreshCookie: refreshToken,
      csrfCookie: csrfToken,
      csrfHeader: xCsrfToken
    };
  };

  it('should refresh token successfully', async () => {
    const credentials = await authenticate();

    const res = await refresh(credentials);

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toContain('access_token');
    expect(res.headers['set-cookie'][1]).toContain('refresh_token');
    expect(res.headers['set-cookie'][2]).toContain('csrf_token');
  });

  it('should revoke the session when an old refresh token is reused', async () => {
    const original = await authenticate();
    const firstRefresh = await refresh(original);

    expect(firstRefresh.status).toBe(200);

    const rotated = readCredentials(firstRefresh.headers['set-cookie']);

    const reuseAttempt = await refresh(original);
    expect(reuseAttempt.status).toBe(401);

    const [session] = await dataSource.getRepository(Session).find();
    expect(session.isRevoked).toBe(true);

    const afterRevoke = await refresh(rotated);
    expect(afterRevoke.status).toBe(401);
  });

  it('should allow the newly rotated refresh token to refresh again', async () => {
    const original = await authenticate();
    const firstRefresh = await refresh(original);

    expect(firstRefresh.status).toBe(200);

    const rotated = readCredentials(firstRefresh.headers['set-cookie']);
    expect(rotated.refreshCookie).not.toBe(original.refreshCookie);

    const secondRefresh = await refresh(rotated);
    expect(secondRefresh.status).toBe(200);
    expect(secondRefresh.headers['set-cookie'][1]).toContain('refresh_token');
  });

  it('should not create inconsistent sessions under concurrent refresh', async () => {
    const original = await authenticate();

    const [first, second] = await Promise.all([
      refresh(original),
      refresh(original)
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);

    expect(
      JSON.stringify(statuses) === JSON.stringify([200, 401]) ||
        JSON.stringify(statuses) === JSON.stringify([200, 429])
    ).toBe(true);

    const sessions = await dataSource.getRepository(Session).find();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].version).toBe(1);

    const winner = first.status === 200 ? first : second;
    const loserStatus = first.status === 200 ? second.status : first.status;

    if (loserStatus === 429) {
      expect(sessions[0].isRevoked).toBe(false);

      const rotated = readCredentials(winner.headers['set-cookie']);
      const nextRefresh = await refresh(rotated);
      expect(nextRefresh.status).toBe(200);
    } else {
      expect(sessions[0].isRevoked).toBe(true);
    }
  });
});
