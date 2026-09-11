import { ClockService } from '@infrastructure/clock/clock.service';
import {
  ISessionRotationUseCase,
  SESSION_ROTATION_USE_CASE
} from '@features/sessions/application/interfaces/sessions.interface';
import { Session } from '@features/sessions/domain/entities/session.entity';
import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisLockService } from '@infrastructure/databases/redis/redis-lock.service';
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
  /**
   * The whole `Set-Cookie` line that issued `refreshCookie`, attributes and
   * all. Kept so a later assertion can compare a deletion against how the
   * cookie was actually written in this environment, rather than restating
   * `Secure`/`SameSite` and drifting from them.
   */
  refreshSetCookie: string;
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
      csrfHeader: getCookieValue(cookies, 'csrf_token'),
      refreshSetCookie:
        cookies.find((cookie) => cookie.startsWith('refresh_token=')) ?? ''
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
        login,
        cookies: { refreshToken, csrfToken },
        headers: { xCsrfToken }
      }
    } = await AuthFactory.authenticated(app, { loginBy: 'email' });

    return {
      refreshCookie: refreshToken,
      csrfCookie: csrfToken,
      csrfHeader: xCsrfToken,
      refreshSetCookie:
        normalizeHeader(login.headers['set-cookie']).find((cookie) =>
          cookie.startsWith('refresh_token=')
        ) ?? ''
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

  it('should re-issue the csrf_token as a persistent cookie on every rotation', async () => {
    const credentials = await authenticate();

    const res = await refresh(credentials);

    const csrf = normalizeHeader(res.headers['set-cookie']).find((cookie) =>
      cookie.startsWith('csrf_token=')
    )!;

    // Rotation must not quietly downgrade it back to a session cookie, which
    // would restore the "authenticated but cannot mutate after a browser
    // restart" gap this lifetime exists to close.
    expect(csrf).toContain('Max-Age=604800');
    expect(csrf).not.toContain('HttpOnly');
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

  /**
   * Two legitimate refreshes of one session, racing. Whichever way the race
   * falls, none of the three possible answers may cost the user their session:
   *
   *  - `200` — the loser queued behind the lock and was served the winner's own
   *    pair from the rotation grace window.
   *  - `429 REFRESH_RATE_LIMITED` — the loser never got the lock.
   *  - `409 REFRESH_ROTATION_CONFLICT` — the lock lapsed mid-flight and the
   *    loser's optimistic write found the row already moved.
   *
   * A `401` here would mean a legitimate concurrent refresh was read as theft,
   * so it is asserted against rather than tolerated.
   */
  it('should not create inconsistent sessions under concurrent refresh', async () => {
    const original = await authenticate();

    const [first, second] = await Promise.all([
      refresh(original),
      refresh(original)
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);

    expect(statuses[0]).toBe(200);
    expect([200, 409, 429]).toContain(statuses[1]);

    const sessions = await dataSource.getRepository(Session).find();
    expect(sessions).toHaveLength(1);
    // One logical rotation, whoever won.
    expect(sessions[0].version).toBe(1);
    expect(sessions[0].isRevoked).toBe(false);

    const winner = first.status === 200 ? first : second;

    // And the session is still usable afterwards.
    const rotated = readCredentials(winner.headers['set-cookie']);
    const nextRefresh = await refresh(rotated);
    expect(nextRefresh.status).toBe(200);
  });

  /**
   * The optimistic rotation losing its compare-and-swap, forced rather than
   * raced for.
   *
   * The natural cause is the five-second `REFRESH_LOCK` expiring while a
   * request is still in flight, which is not something a test can schedule.
   * What it *can* do is make the rotation report `affected = 0` — the exact
   * signal the use case reads — and then assert the whole HTTP path: status,
   * code, that the session survives, and that the cookie survives with it.
   */
  it('should answer a lost optimistic rotation with a retryable 409 and keep the session', async () => {
    const credentials = await authenticate();
    const rotation = app.get<ISessionRotationUseCase>(
      SESSION_ROTATION_USE_CASE
    );

    const lostWrite = jest
      .spyOn(rotation, 'execute')
      .mockResolvedValueOnce(false);

    try {
      const res = await refresh(credentials);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('REFRESH_ROTATION_CONFLICT');
      expect(res.body.error.domain).toBe('SESSION');

      // The cookie the retry has to be made with is still in the browser.
      expect(
        normalizeHeader(res.headers['set-cookie']).find((cookie) =>
          cookie.startsWith('refresh_token=')
        )
      ).toBeUndefined();
    } finally {
      lostWrite.mockRestore();
    }

    const [session] = await dataSource.getRepository(Session).find();

    // Not reuse: nothing revoked, nothing rotated.
    expect(session.isRevoked).toBe(false);
    expect(session.version).toBe(0);

    // The retry the client is entitled to make, with the cookie it still holds.
    const retry = await refresh(credentials);
    expect(retry.status).toBe(200);
  });

  /**
   * A refresh token the server has just refused is dead for good, but the
   * browser has no way to know that — the cookie is `HttpOnly`, so only a
   * `Set-Cookie` can remove it. Left in place it survived the cookie's full
   * seven days and was re-sent on every subsequent 401 → refresh cycle.
   *
   * These assertions read the wire header rather than the interceptor, because
   * what matters is whether a browser would actually drop the cookie: an empty
   * value plus an expiry in the past, carrying the same identity attributes the
   * cookie was written with.
   */
  describe('refresh_token cookie lifecycle on failure', () => {
    /** The attributes a browser matches on when deciding what a delete deletes. */
    const IDENTITY_ATTRIBUTES = ['Path', 'Domain', 'Secure', 'SameSite'];

    const setCookieFor = (
      res: request.Response,
      name: string
    ): string | undefined =>
      normalizeHeader(res.headers['set-cookie']).find((cookie) =>
        cookie.startsWith(`${name}=`)
      );

    /** `Path=/; HttpOnly; SameSite=Lax` → `{ Path: '/', SameSite: 'Lax' }`. */
    const identityOf = (setCookie: string) =>
      Object.fromEntries(
        IDENTITY_ATTRIBUTES.map((attribute) => {
          const match = new RegExp(
            `(?:^|;\\s*)${attribute}(?:=([^;]*))?`,
            'i'
          ).exec(setCookie);

          return [attribute, match ? (match[1] ?? true) : undefined];
        })
      );

    /**
     * @param writtenAs the `Set-Cookie` that issued the token being rejected.
     *   Compared against rather than restating `Secure`/`SameSite` here, so
     *   the assertion follows the policy across environments instead of
     *   pinning today's development values.
     */
    const expectRefreshCookieCleared = (
      res: request.Response,
      writtenAs: string
    ) => {
      const header = setCookieFor(res, 'refresh_token');

      expect(header).toBeDefined();
      // Empty value, so nothing usable is handed back.
      expect(header).toMatch(/^refresh_token=;/);
      // Express deletes `maxAge` and forces the epoch. That is a deletion in
      // the browser exactly as `Max-Age=0` would be.
      expect(header).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      expect(header).not.toContain('Max-Age=');
      // Still HttpOnly: the delete must not be the one response that hands
      // JavaScript a readable refresh_token.
      expect(header).toContain('HttpOnly');
      // And it must be recognisable as the *same* cookie, or the browser files
      // it as a new one and keeps the live token.
      expect(identityOf(header!)).toEqual(identityOf(writtenAs));
      expect(identityOf(header!).Path).toBe('/');
    };

    const expectNoRefreshCookieHeader = (res: request.Response) => {
      expect(setCookieFor(res, 'refresh_token')).toBeUndefined();
    };

    const currentSession = async () => {
      const [session] = await dataSource.getRepository(Session).find();
      return session;
    };

    it('clears the cookie when the session has expired', async () => {
      const credentials = await authenticate();
      const session = await currentSession();

      await dataSource
        .getRepository(Session)
        .update(
          { id: session.id },
          { expiresAt: clockService.addDaysFrom(clockService.nowMs(), -1) }
        );

      const res = await refresh(credentials);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('SESSION_EXPIRED');
      expectRefreshCookieCleared(res, credentials.refreshSetCookie);
    });

    /**
     * `findActiveSession` filters on `isRevoked` and expiry together, so a
     * revoked session is indistinguishable from an expired one at this point
     * and surfaces as `SESSION_EXPIRED`. Deliberate: telling a caller which of
     * the two happened says something about a session it no longer holds.
     */
    it('clears the cookie when the session has been revoked', async () => {
      const credentials = await authenticate();
      const session = await currentSession();

      await dataSource
        .getRepository(Session)
        .update({ id: session.id }, { isRevoked: true });

      const res = await refresh(credentials);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('SESSION_EXPIRED');
      expectRefreshCookieCleared(res, credentials.refreshSetCookie);
    });

    it('clears the cookie when the token is tampered with', async () => {
      const credentials = await authenticate();
      const [, token] = credentials.refreshCookie.split('=');
      const [header, payload] = token.split('.');

      const res = await refresh({
        ...credentials,
        // Original header and payload, a signature that verifies against
        // nothing — the shape a forged cookie actually takes.
        refreshCookie: `refresh_token=${header}.${payload}.notavalidsignature`
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
      expectRefreshCookieCleared(res, credentials.refreshSetCookie);
    });

    it('clears the cookie when no refresh cookie was sent at all', async () => {
      const { refreshSetCookie } = await authenticate();
      const res = await request(app.getHttpServer()).post('/v1/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
      // Harmless where there was nothing to delete, and it is the response the
      // browser gets after its cookie was cleared once already.
      expectRefreshCookieCleared(res, refreshSetCookie);
    });

    /**
     * Replay revokes the session, which kills the legitimate browser's token
     * too. That browser then arrives holding a cookie that can never work
     * again, so clearing it is the whole point rather than collateral.
     */
    it('clears the cookie when replay is detected', async () => {
      const original = await authenticate();

      const first = await refresh(original);
      expect(first.status).toBe(200);

      const rotated = readCredentials(first.headers['set-cookie']);
      const second = await refresh(rotated);
      expect(second.status).toBe(200);

      // Two generations back, so outside the rotation grace window.
      const replay = await refresh(original);

      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe('SESSION_REUSE_DETECTED');
      expectRefreshCookieCleared(replay, original.refreshSetCookie);

      expect((await currentSession()).isRevoked).toBe(true);

      // And the legitimate holder of the current token, arriving after the
      // revocation, is told to drop its cookie as well.
      const legitimate = await refresh(
        readCredentials(second.headers['set-cookie'])
      );

      expect(legitimate.status).toBe(401);
      expectRefreshCookieCleared(
        legitimate,
        readCredentials(second.headers['set-cookie']).refreshSetCookie
      );
    });

    /**
     * The one failure that must not touch the cookie. Losing the refresh lock
     * means the token was never examined, and the retry the client is entitled
     * to make needs a credential to make it with.
     */
    it('keeps the cookie when another refresh holds the session lock', async () => {
      const credentials = await authenticate();
      const session = await currentSession();
      const lockService = app.get(RedisLockService);

      const heldBy = await lockService.acquire(
        RedisKey.REFRESH_LOCK,
        session.id
      );
      expect(heldBy).not.toBeNull();

      try {
        const res = await refresh(credentials);

        expect(res.status).toBe(429);
        expect(res.body.error.code).toBe('REFRESH_RATE_LIMITED');
        expectNoRefreshCookieHeader(res);
      } finally {
        await lockService.release(RedisKey.REFRESH_LOCK, session.id, heldBy!);
      }

      // The proof that matters: the cookie the browser still holds works.
      const retry = await refresh(credentials);
      expect(retry.status).toBe(200);
    });

    it('replaces rather than clears the cookie on a successful rotation', async () => {
      const credentials = await authenticate();

      const res = await refresh(credentials);
      const header = setCookieFor(res, 'refresh_token')!;

      expect(res.status).toBe(200);
      // A real token with a real lifetime, not a deletion.
      expect(header).not.toMatch(/^refresh_token=;/);
      expect(header).toContain('Max-Age=604800');
      expect(header).toContain('HttpOnly');
      expect(header).not.toContain('Expires=Thu, 01 Jan 1970');
      // Same identity as the cookie it replaces, so it overwrites rather than
      // sitting alongside it.
      expect(identityOf(header)).toEqual(
        identityOf(credentials.refreshSetCookie)
      );

      const rotated = readCredentials(res.headers['set-cookie']);
      expect(rotated.refreshCookie).not.toBe(credentials.refreshCookie);

      // Replaced, not merely added alongside: the new one refreshes again.
      const next = await refresh(rotated);
      expect(next.status).toBe(200);
    });
  });
});
