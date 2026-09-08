import { ClockService } from '@infrastructure/clock/clock.service';
import { Session } from '@features/sessions/domain/entities/session.entity';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { truncateDatabase } from '../helpers/postgresql.helper';
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
  let clockService: ClockService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } =
      await createMigratedTestApp();

    app = testApp;
    clockService = app.get(ClockService);
    dataSource = testDataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
  });

  afterAll(async () => {
    await app?.close();
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

  it('should serve a near-simultaneous retry of the just-rotated token without revoking', async () => {
    const original = await authenticate();
    const firstRefresh = await refresh(original);

    expect(firstRefresh.status).toBe(200);

    // The ordinary cross-process race: a request that left before the
    // winner's Set-Cookie landed still carries the previous token. Inside the
    // rotation grace window that is answered with the winner's own pair
    // rather than treated as replay.
    const raced = await refresh(original);
    expect(raced.status).toBe(200);

    const winner = readCredentials(firstRefresh.headers['set-cookie']);
    const loser = readCredentials(raced.headers['set-cookie']);

    // The same pair, not a second lineage — one logical rotation.
    expect(loser.refreshCookie).toBe(winner.refreshCookie);

    const [session] = await dataSource.getRepository(Session).find();
    expect(session.isRevoked).toBe(false);
    // One rotation only.
    expect(session.version).toBe(1);
  });

  it('should revoke the session when a token from an older generation is replayed', async () => {
    const original = await authenticate();
    const firstRefresh = await refresh(original);

    expect(firstRefresh.status).toBe(200);

    const rotated = readCredentials(firstRefresh.headers['set-cookie']);
    const secondRefresh = await refresh(rotated);

    expect(secondRefresh.status).toBe(200);

    const current = readCredentials(secondRefresh.headers['set-cookie']);

    // `original` is now two rotations behind. The grace window only ever
    // covers the immediately previous generation, so this is replay however
    // quickly it arrives — no waiting, and nothing timing-dependent about it.
    const reuseAttempt = await refresh(original);
    expect(reuseAttempt.status).toBe(401);
    expect(reuseAttempt.body.error.code).toBe('SESSION_REUSE_DETECTED');

    const [session] = await dataSource.getRepository(Session).find();
    expect(session.isRevoked).toBe(true);

    // Revocation kills the session outright, including its current token.
    const afterRevoke = await refresh(current);
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

  it('should update session activity after a successful refresh', async () => {
    const credentials = await authenticate();
    const repository = dataSource.getRepository(Session);
    const [session] = await repository.find();
    const staleActivity = clockService.addDaysFrom(clockService.nowMs(), -1);
    await repository.update({ id: session.id }, { lastUsedAt: staleActivity });

    const res = await refresh(credentials);
    const updated = await repository.findOneByOrFail({ id: session.id });

    expect(res.status).toBe(200);
    expect(updated.lastUsedAt.getTime()).toBeGreaterThan(
      staleActivity.getTime()
    );
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
