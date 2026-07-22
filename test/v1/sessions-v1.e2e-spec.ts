import { Session } from '@features/sessions/entities/session.entity';
import { User } from '@features/users/entities/user.entity';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { runMigrations, truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

describe('Sessions (e2e) version: 1', () => {
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

  it('should return active sessions', async () => {
    const { client } = await AuthFactory.authenticated(app, {});

    const res = await client.get('/v1/sessions');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual(expect.any(Array));
    expect('nextCursor' in res.body.data).toBe(true);
  });

  it('should return every SessionResponseDto field for each session', async () => {
    const { client } = await AuthFactory.authenticated(app, {});

    await AuthFactory.authenticated(app, {});

    const res = await client.get('/v1/sessions');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.currentSession).toBeDefined();

    const other = res.body.data.items[0];

    for (const session of [res.body.data.currentSession, other]) {
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

      expect(session.validUntil).toEqual(expect.any(String));
      expect(new Date(session.validUntil).getTime()).toBeGreaterThan(
        Date.now()
      );

      expect(session.ipAddress).toEqual(expect.any(String));
    }

    expect(res.body.data.currentSession.sessionId).not.toBe(other.sessionId);
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
    expect(sessionsRes.body.data.items).toHaveLength(1);

    const terminateOtherSessionsRes = await client
      .delete('/v1/sessions/others')
      .set('Cookie', `${refreshToken}; ${csrfToken}`)
      .set('X-CSRF-Token', xCsrfToken);

    expect(terminateOtherSessionsRes.status).toBe(204);
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
    expect(res.body.data.items).toHaveLength(1);

    const currentSession = res.body.data.currentSession;
    const other = res.body.data.items[0];

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
    expect(res.body.data.items).toHaveLength(2);

    const sessionIds = res.body.data.items.map(
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
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.nextCursor).toEqual(expect.any(String));
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
      expect(firstPage.body.data.items).toHaveLength(1);
      expect(firstPage.body.data.nextCursor).toEqual(expect.any(String));

      const secondPage = await client
        .get('/v1/sessions')
        .query({ limit: 1, cursor: firstPage.body.data.nextCursor });

      expect(secondPage.status).toBe(200);
      expect(secondPage.body.data.items).toHaveLength(1);
    });

    it('should return null nextCursor on last page', async () => {
      const { client, user } = await AuthFactory.authenticated(app, {});
      const userId = await userIdByEmail(user.email);

      await insertSession(userId);

      const res = await client.get('/v1/sessions').query({ limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.nextCursor).toBeNull();
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
      expect(page1.body.data.nextCursor).toEqual(expect.any(String));

      const page2 = await client
        .get('/v1/sessions')
        .query({ limit: 1, cursor: page1.body.data.nextCursor });
      expect(page2.status).toBe(200);

      const allIds = [
        ...page1.body.data.items.map((s: { sessionId: string }) => s.sessionId),
        ...page2.body.data.items.map((s: { sessionId: string }) => s.sessionId)
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
      const currentSessionId = page1.body.data.currentSession.sessionId;
      const p1Ids = page1.body.data.items.map(
        (s: { sessionId: string }) => s.sessionId
      );

      const page2 = await client
        .get('/v1/sessions')
        .query({ limit: 1, cursor: page1.body.data.nextCursor });
      const p2Ids = page2.body.data.items.map(
        (s: { sessionId: string }) => s.sessionId
      );

      const page3 = await client
        .get('/v1/sessions')
        .query({ limit: 1, cursor: page2.body.data.nextCursor });
      const p3Ids = page3.body.data.items.map(
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
        .query({ limit: 1, cursor: page1.body.data.nextCursor });
      const page3 = await client
        .get('/v1/sessions')
        .query({ limit: 1, cursor: page2.body.data.nextCursor });

      const paginatedIds = [
        ...page1.body.data.items.map((s: { sessionId: string }) => s.sessionId),
        ...page2.body.data.items.map((s: { sessionId: string }) => s.sessionId),
        ...page3.body.data.items.map((s: { sessionId: string }) => s.sessionId)
      ];

      const singlePage = await client.get('/v1/sessions').query({ limit: 50 });
      const singlePageIds = singlePage.body.data.items.map(
        (s: { sessionId: string }) => s.sessionId
      );

      expect(paginatedIds).toEqual(singlePageIds);
    });
  });
});
