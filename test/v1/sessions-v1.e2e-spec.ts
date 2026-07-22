import { Session } from '@features/sessions/entities/session.entity';
import { INestApplication } from '@nestjs/common';
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
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should return every SessionResponseDto field for each session', async () => {
    const { client } = await AuthFactory.authenticated(app, {});

    // A second login creates another session for the same user.
    await AuthFactory.authenticated(app, {});

    const res = await client.get('/v1/sessions');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);

    const [current, other] = res.body.data;

    // Current session is first and flagged.
    expect(current.current).toBe(true);
    expect(other.current).toBeUndefined();

    for (const session of [current, other]) {
      // session id
      expect(session.sessionId).toEqual(expect.any(String));
      expect(session.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );

      // last activity
      expect(session.lastActivityAt).toEqual(expect.any(String));
      expect(new Date(session.lastActivityAt).getTime()).not.toBeNaN();

      // device
      expect(session.deviceInfo).toEqual({
        browserName: expect.any(String),
        browserVersion: expect.any(String),
        osName: expect.any(String),
        deviceType: expect.stringMatching(/^(mobile|tablet|desktop)$/)
      });

      // expiration — a valid date in the future
      expect(session.validUntil).toEqual(expect.any(String));
      expect(new Date(session.validUntil).getTime()).toBeGreaterThan(
        Date.now()
      );

      expect(session.ipAddress).toEqual(expect.any(String));
    }

    // The two sessions are distinct.
    expect(current.sessionId).not.toBe(other.sessionId);
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
    expect(sessionsRes.body.data).toHaveLength(2);

    const terminateOtherSessionsRes = await client
      .delete('/v1/sessions/others')
      .set('Cookie', `${refreshToken}; ${csrfToken}`)
      .set('X-CSRF-Token', xCsrfToken);

    expect(terminateOtherSessionsRes.status).toBe(204);
  });

  it('should return sessions ordered by lastActivityAt ascending', async () => {
    const { client } = await AuthFactory.authenticated(app, {});

    // Create a second session via login
    await AuthFactory.authenticated(app, {});

    const repo = dataSource.getRepository(Session);
    const sessions = await repo.find({ order: { createdAt: 'ASC' } });
    expect(sessions).toHaveLength(2);

    const [older, newer] = sessions;

    // Set distinct lastUsedAt values to verify ordering
    await repo.update(older.id, {
      lastUsedAt: new Date('2026-01-01T00:00:00.000Z')
    });
    await repo.update(newer.id, {
      lastUsedAt: new Date('2026-06-01T00:00:00.000Z')
    });

    const res = await client.get('/v1/sessions');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);

    // Current session is always first, then others ordered by lastActivityAt ASC
    const [current, other] = res.body.data;
    expect(current.current).toBe(true);
    expect(other.current).toBeUndefined();

    const currentLastActivity = new Date(current.lastActivityAt).getTime();
    const otherLastActivity = new Date(other.lastActivityAt).getTime();
    expect(currentLastActivity).toBeLessThanOrEqual(otherLastActivity);
  });

  it('should use id as final tie-breaker when timestamps are identical', async () => {
    const { client } = await AuthFactory.authenticated(app, {});

    // Create two more sessions
    await AuthFactory.authenticated(app, {});
    await AuthFactory.authenticated(app, {});

    const repo = dataSource.getRepository(Session);
    const sessions = await repo.find({ order: { createdAt: 'ASC' } });
    expect(sessions).toHaveLength(3);

    const equalTimestamp = new Date('2026-03-15T12:00:00.000Z');

    // Set all sessions to the same lastUsedAt and createdAt
    for (const s of sessions) {
      await repo.update(s.id, {
        lastUsedAt: equalTimestamp,
        createdAt: equalTimestamp
      });
    }

    const res = await client.get('/v1/sessions');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);

    // Current session is first; remaining sorted by id ASC
    const sessionIds = res.body.data.map(
      (s: { sessionId: string }) => s.sessionId
    );

    const otherIds = sessionIds.slice(1);
    const sortedIds = [...otherIds].sort();
    expect(otherIds).toEqual(sortedIds);
  });
});
