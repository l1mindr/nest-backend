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
});
