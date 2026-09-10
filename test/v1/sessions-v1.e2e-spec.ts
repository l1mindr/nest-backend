import { Session } from '@features/sessions/domain/entities/session.entity';
import { User } from '@features/users/domain/entities/user.entity';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

describe('Sessions (e2e) version: 1', () => {
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

  it('should return active sessions', async () => {
    const { client } = await AuthFactory.authenticated(app, {});

    const res = await client.get('/v1/sessions');

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(expect.any(Array));
    expect('nextCursor' in res.body).toBe(true);
  });

  it('should return every SessionResponseDto field for each session', async () => {
    const { client } = await AuthFactory.authenticated(app, {});

    await AuthFactory.authenticated(app, {});

    const res = await client.get('/v1/sessions');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.currentSession).toBeDefined();

    const other = res.body.items[0];

    for (const session of [res.body.currentSession, other]) {
      expect(session.sessionId).toEqual(expect.any(String));
      expect(session.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );

      expect(session.lastActivityAt).toEqual(expect.any(String));
      expect(new Date(session.lastActivityAt).getTime()).not.toBeNaN();

      expect(session.deviceInfo).toEqual({
        browserName: expect.any(String),
        browserVersion: expect.any(String),
        osName: expect.any(String),
        deviceType: expect.stringMatching(/^(mobile|tablet|desktop)$/)
      });

      expect(session.expiresAt).toEqual(expect.any(String));
      expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());

      expect(session.ipAddress).toEqual(expect.any(String));
    }

    expect(res.body.currentSession.sessionId).not.toBe(other.sessionId);
  });

  it('should return 204 when logout successfully', async () => {
    const {
      client,
      response: {
        cookies: { refreshToken, csrfToken },
        headers: { xCsrfToken }
      }
    } = await AuthFactory.authenticated(app, {});

    const logoutRes = await client
      .delete('/v1/sessions')
      .set('Cookie', `${refreshToken}; ${csrfToken}`)
      .set('X-CSRF-Token', xCsrfToken);

    const meRes = await client.get('/v1/user/me');

    expect(logoutRes.status).toBe(204);
    expect(meRes.status).toBe(401);
  });

  it('should not revoke another user session (cross-user isolation)', async () => {
    const userA = await AuthFactory.authenticated(app, {
      overrides: { email: 'user-a@test.com', username: 'userasessions' }
    });
    const userB = await AuthFactory.authenticated(app, {
      overrides: { email: 'user-b@test.com', username: 'userbsessions' }
    });

    const {
      client: clientA,
      response: {
        cookies: { refreshToken, csrfToken },
        headers: { xCsrfToken }
      }
    } = userA;

    const logoutRes = await clientA
      .delete('/v1/sessions')
      .set('Cookie', `${refreshToken}; ${csrfToken}`)
      .set('X-CSRF-Token', xCsrfToken);

    expect(logoutRes.status).toBe(204);

    const meA = await clientA.get('/v1/user/me');
    expect(meA.status).toBe(401);

    const meB = await userB.client.get('/v1/user/me');
    expect(meB.status).toBe(200);
  });

  it('should terminate other sessions', async () => {
    const {
      client,
      response: {
        cookies: { refreshToken, csrfToken },
        headers: { xCsrfToken }
      }
    } = await AuthFactory.authenticated(app, {});

    await AuthFactory.authenticated(app, {});

    const sessionsRes = await client.get('/v1/sessions');

    expect(sessionsRes.status).toBe(200);
    expect(sessionsRes.body.items).toHaveLength(1);

    const terminateOtherSessionsRes = await client
      .delete('/v1/sessions/others')
      .set('Cookie', `${refreshToken}; ${csrfToken}`)
      .set('X-CSRF-Token', xCsrfToken);

    expect(terminateOtherSessionsRes.status).toBe(204);
  });

  describe('revoking one other session', () => {
    /** Signs in twice as the same user and returns both, plus the other id. */
    async function twoSessions() {
      const owner = await AuthFactory.authenticated(app, {});
      const second = await AuthFactory.authenticated(app, {});

      const listed = await owner.client.get('/v1/sessions');

      expect(listed.status).toBe(200);
      expect(listed.body.items).toHaveLength(1);

      return { owner, second, otherId: listed.body.items[0].sessionId };
    }

    function auth(
      context: Awaited<ReturnType<typeof AuthFactory.authenticated>>
    ) {
      const {
        cookies: { refreshToken, csrfToken },
        headers: { xCsrfToken }
      } = context.response;

      return { cookie: `${refreshToken}; ${csrfToken}`, xCsrfToken };
    }

    it('should revoke the addressed session and leave the caller signed in', async () => {
      const { owner, second, otherId } = await twoSessions();
      const { cookie, xCsrfToken } = auth(owner);

      const response = await owner.client
        .delete(`/v1/sessions/${otherId}`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', xCsrfToken);

      expect(response.status).toBe(204);

      // The revoked device is out...
      expect((await second.client.get('/v1/user/me')).status).toBe(401);
      // ...and the caller is not.
      expect((await owner.client.get('/v1/user/me')).status).toBe(200);
    });

    it('should drop the revoked session from the list', async () => {
      const { owner, otherId } = await twoSessions();
      const { cookie, xCsrfToken } = auth(owner);

      await owner.client
        .delete(`/v1/sessions/${otherId}`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', xCsrfToken);

      const listed = await owner.client.get('/v1/sessions');

      expect(listed.status).toBe(200);
      expect(listed.body.items).toHaveLength(0);
    });

    // A second delete would otherwise report success for a device that was
    // already signed out, from a list the caller had not refreshed.
    it('should return 404 when the session is already revoked', async () => {
      const { owner, otherId } = await twoSessions();
      const { cookie, xCsrfToken } = auth(owner);

      await owner.client
        .delete(`/v1/sessions/${otherId}`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', xCsrfToken);

      const again = await owner.client
        .delete(`/v1/sessions/${otherId}`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', xCsrfToken);

      expect(again.status).toBe(404);
      expect(again.body.error.code).toBe('SESSION_NOT_FOUND');
    });

    it('should return 404 for an id that does not exist', async () => {
      const owner = await AuthFactory.authenticated(app, {});
      const { cookie, xCsrfToken } = auth(owner);

      const response = await owner.client
        .delete(`/v1/sessions/${randomUUID()}`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', xCsrfToken);

      expect(response.status).toBe(404);
    });

    // Another account's session is indistinguishable from a missing one.
    it('should not revoke a session belonging to another user', async () => {
      const userA = await AuthFactory.authenticated(app, {
        overrides: { email: 'revoke-a@test.com', username: 'revokea' }
      });
      const userB = await AuthFactory.authenticated(app, {
        overrides: { email: 'revoke-b@test.com', username: 'revokeb' }
      });

      const listedB = await userB.client.get('/v1/sessions');
      const targetId = listedB.body.currentSession.sessionId;
      const { cookie, xCsrfToken } = auth(userA);

      const response = await userA.client
        .delete(`/v1/sessions/${targetId}`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', xCsrfToken);

      expect(response.status).toBe(404);
      // B is untouched.
      expect((await userB.client.get('/v1/user/me')).status).toBe(200);
    });

    // Ending the current session is a logout, and that route also clears the
    // auth cookies — doing it here would strand dead credentials in the browser.
    it('should refuse the current session and point at the logout route', async () => {
      const owner = await AuthFactory.authenticated(app, {});
      const listed = await owner.client.get('/v1/sessions');
      const currentId = listed.body.currentSession.sessionId;
      const { cookie, xCsrfToken } = auth(owner);

      const response = await owner.client
        .delete(`/v1/sessions/${currentId}`)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', xCsrfToken);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('SESSION_IS_CURRENT');
      // Still signed in.
      expect((await owner.client.get('/v1/user/me')).status).toBe(200);
    });

    it('should reject an id that is not a UUID', async () => {
      const owner = await AuthFactory.authenticated(app, {});
      const { cookie, xCsrfToken } = auth(owner);

      const response = await owner.client
        .delete('/v1/sessions/not-a-uuid')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', xCsrfToken);

      expect(response.status).toBe(422);
    });

    // The literal segment is declared first, so it must never be read as an id.
    it('should still route /others to the bulk endpoint', async () => {
      const { owner } = await twoSessions();
      const { cookie, xCsrfToken } = auth(owner);

      const response = await owner.client
        .delete('/v1/sessions/others')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', xCsrfToken);

      expect(response.status).toBe(204);
      expect((await owner.client.get('/v1/sessions')).body.items).toHaveLength(
        0
      );
    });

    it('should require the CSRF header', async () => {
      const { owner, otherId } = await twoSessions();
      const {
        cookies: { refreshToken, csrfToken }
      } = owner.response;

      const response = await owner.client
        .delete(`/v1/sessions/${otherId}`)
        .set('Cookie', `${refreshToken}; ${csrfToken}`);

      expect(response.status).toBe(403);
    });
  });

  it('should return sessions ordered by lastActivityAt ascending', async () => {
    const { client } = await AuthFactory.authenticated(app, {});

    await AuthFactory.authenticated(app, {});

    const repo = dataSource.getRepository(Session);
    const sessions = await repo.find({ order: { createdAt: 'ASC' } });
    expect(sessions).toHaveLength(2);

    const [older, newer] = sessions;

    await repo.update(older.id, {
      lastUsedAt: new Date('2026-01-01T00:00:00.000Z')
    });
    await repo.update(newer.id, {
      lastUsedAt: new Date('2026-06-01T00:00:00.000Z')
    });

    const res = await client.get('/v1/sessions');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);

    const currentSession = res.body.currentSession;
    const other = res.body.items[0];

    const currentLastActivity = new Date(
      currentSession.lastActivityAt
    ).getTime();
    const otherLastActivity = new Date(other.lastActivityAt).getTime();
    expect(currentLastActivity).toBeLessThanOrEqual(otherLastActivity);
  });

  it('should use id as final tie-breaker when timestamps are identical', async () => {
    const { client } = await AuthFactory.authenticated(app, {});

    await AuthFactory.authenticated(app, {});
    await AuthFactory.authenticated(app, {});

    const repo = dataSource.getRepository(Session);
    const sessions = await repo.find({ order: { createdAt: 'ASC' } });
    expect(sessions).toHaveLength(3);

    const equalTimestamp = new Date('2026-03-15T12:00:00.000Z');

    for (const s of sessions) {
      await repo.update(s.id, {
        lastUsedAt: equalTimestamp,
        createdAt: equalTimestamp
      });
    }

    const res = await client.get('/v1/sessions');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);

    const sessionIds = res.body.items.map(
      (s: { sessionId: string }) => s.sessionId
    );

    const sortedIds = [...sessionIds].sort();
    expect(sessionIds).toEqual(sortedIds);
  });

  describe('cursor-based pagination', () => {
    const device = {
      browserName: 'Chrome',
      browserVersion: '148.0.0',
      osName: 'MacOS',
      deviceType: 'desktop' as const
    };

    async function insertSession(
      userId: string,
      overrides?: Partial<Session>
    ): Promise<Session> {
      const repo = dataSource.getRepository(Session);
      const session = repo.create({
        owner: { id: userId },
        ipAddress: '127.0.0.1',
        device,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        lastUsedAt: new Date(),
        refreshTokenHash: randomUUID(),
        ...overrides
      });
      return repo.save(session);
    }

    async function userIdByEmail(email: string): Promise<string> {
      const user = await dataSource
        .getRepository(User)
        .findOneByOrFail({ email });
      return user.id;
    }

    it('should return first page with current session and other sessions', async () => {
      const { client, user } = await AuthFactory.authenticated(app, {});
      const userId = await userIdByEmail(user.email);

      await insertSession(userId);
      await insertSession(userId);

      const res = await client.get('/v1/sessions').query({ limit: 1 });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.nextCursor).toEqual(expect.any(String));
    });

    it('should return second page using cursor', async () => {
      const { client, user } = await AuthFactory.authenticated(app, {});
      const userId = await userIdByEmail(user.email);

      await insertSession(userId, {
        lastUsedAt: new Date('2026-01-01T00:00:00.000Z')
      });
      await insertSession(userId, {
        lastUsedAt: new Date('2026-06-01T00:00:00.000Z')
      });

      const firstPage = await client.get('/v1/sessions').query({ limit: 1 });
      expect(firstPage.body.items).toHaveLength(1);
      expect(firstPage.body.nextCursor).toEqual(expect.any(String));

      const secondPage = await client
        .get('/v1/sessions')
        .query({ limit: 1, cursor: firstPage.body.nextCursor });

      expect(secondPage.status).toBe(200);
      expect(secondPage.body.items).toHaveLength(1);
    });

    it('should return null nextCursor on last page', async () => {
      const { client, user } = await AuthFactory.authenticated(app, {});
      const userId = await userIdByEmail(user.email);

      await insertSession(userId);

      const res = await client.get('/v1/sessions').query({ limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.nextCursor).toBeNull();
    });

    it('should return 400 for invalid cursor', async () => {
      const { client } = await AuthFactory.authenticated(app, {});

      const res = await client
        .get('/v1/sessions')
        .query({ cursor: '!!!invalid!!!' });

      expect(res.status).toBe(400);
    });

    it('should return 422 for invalid limit values', async () => {
      const { client } = await AuthFactory.authenticated(app, {});

      const zeroRes = await client.get('/v1/sessions').query({ limit: 0 });
      expect(zeroRes.status).toBe(422);

      const negativeRes = await client.get('/v1/sessions').query({ limit: -1 });
      expect(negativeRes.status).toBe(422);

      const tooLargeRes = await client
        .get('/v1/sessions')
        .query({ limit: 100 });
      expect(tooLargeRes.status).toBe(422);
    });

    it('should not duplicate sessions between pages', async () => {
      const { client, user } = await AuthFactory.authenticated(app, {});
      const userId = await userIdByEmail(user.email);

      const timestamps = [
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-03-01T00:00:00.000Z')
      ];

      for (const ts of timestamps) {
        await insertSession(userId, { lastUsedAt: ts });
      }

      const page1 = await client.get('/v1/sessions').query({ limit: 1 });
      expect(page1.status).toBe(200);
      expect(page1.body.nextCursor).toEqual(expect.any(String));

      const page2 = await client
        .get('/v1/sessions')
        .query({ limit: 1, cursor: page1.body.nextCursor });
      expect(page2.status).toBe(200);

      const allIds = [
        ...page1.body.items.map((s: { sessionId: string }) => s.sessionId),
        ...page2.body.items.map((s: { sessionId: string }) => s.sessionId)
      ];
      expect(new Set(allIds).size).toBe(allIds.length);
    });

    it('should not skip sessions between pages', async () => {
      const { client, user } = await AuthFactory.authenticated(app, {});
      const userId = await userIdByEmail(user.email);
      const repo = dataSource.getRepository(Session);

      const timestamps = [
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-03-01T00:00:00.000Z')
      ];

      for (const ts of timestamps) {
        await insertSession(userId, { lastUsedAt: ts });
      }

      const page1 = await client.get('/v1/sessions').query({ limit: 1 });
      const currentSessionId = page1.body.currentSession.sessionId;
      const p1Ids = page1.body.items.map(
        (s: { sessionId: string }) => s.sessionId
      );

      const page2 = await client
        .get('/v1/sessions')
        .query({ limit: 1, cursor: page1.body.nextCursor });
      const p2Ids = page2.body.items.map(
        (s: { sessionId: string }) => s.sessionId
      );

      const page3 = await client
        .get('/v1/sessions')
        .query({ limit: 1, cursor: page2.body.nextCursor });
      const p3Ids = page3.body.items.map(
        (s: { sessionId: string }) => s.sessionId
      );

      const fetchedIds = [...p1Ids, ...p2Ids, ...p3Ids];

      const allSessions = await repo.find({
        where: { owner: { id: userId }, isRevoked: false },
        order: { id: 'ASC' }
      });
      const dbIds = allSessions
        .filter((s) => s.id !== currentSessionId)
        .map((s) => s.id);

      expect(fetchedIds.sort()).toEqual(dbIds.sort());
    });

    it('should maintain stable ordering across paginated requests', async () => {
      const { client, user } = await AuthFactory.authenticated(app, {});
      const userId = await userIdByEmail(user.email);

      const timestamps = [
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-03-01T00:00:00.000Z')
      ];

      for (const ts of timestamps) {
        await insertSession(userId, { lastUsedAt: ts });
      }

      const page1 = await client.get('/v1/sessions').query({ limit: 1 });
      const page2 = await client
        .get('/v1/sessions')
        .query({ limit: 1, cursor: page1.body.nextCursor });
      const page3 = await client
        .get('/v1/sessions')
        .query({ limit: 1, cursor: page2.body.nextCursor });

      const paginatedIds = [
        ...page1.body.items.map((s: { sessionId: string }) => s.sessionId),
        ...page2.body.items.map((s: { sessionId: string }) => s.sessionId),
        ...page3.body.items.map((s: { sessionId: string }) => s.sessionId)
      ];

      const singlePage = await client.get('/v1/sessions').query({ limit: 50 });
      const singlePageIds = singlePage.body.items.map(
        (s: { sessionId: string }) => s.sessionId
      );

      expect(paginatedIds).toEqual(singlePageIds);
    });
  });
});
