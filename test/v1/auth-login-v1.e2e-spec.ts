import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { UserFactory } from '../factories/user.factory';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { normalizeHeader } from '../utils/cookie.util';

describe('Auth Login (e2e) version: 1', () => {
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

  it('should login successfully with email', async () => {
    const {
      response: { login }
    } = await AuthFactory.authenticated(app, {
      loginBy: 'email'
    });

    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']).toBeDefined();
    expect(login.headers['set-cookie'][0]).toContain('access_token');
    expect(login.headers['set-cookie'][1]).toContain('refresh_token');
  });

  /**
   * The CSRF cookie is persistent, on the wire, for the same seven days as the
   * refresh token.
   *
   * It used to carry no `Max-Age`, which made it a session cookie: closing the
   * browser dropped it while `refresh_token` survived the week, so the
   * reopened browser was authenticated with no CSRF token and the first unsafe
   * request answered 403. Nothing recovered from that on its own — the client
   * refreshes on 401 only — so a still-valid access token could keep the user
   * blocked for up to fifteen minutes.
   *
   * Asserted here rather than only in a unit test because `Max-Age` is a
   * property of the header Express actually emits.
   */
  it('should issue a persistent csrf_token matching the refresh window', async () => {
    const {
      response: { login }
    } = await AuthFactory.authenticated(app, { loginBy: 'email' });

    const cookies = normalizeHeader(login.headers['set-cookie']);
    const csrf = cookies.find((cookie) => cookie.startsWith('csrf_token='))!;
    const refresh = cookies.find((cookie) =>
      cookie.startsWith('refresh_token=')
    )!;

    expect(csrf).toContain('Max-Age=604800');
    expect(csrf).toContain('Expires=');
    // Same window as the session that can present it.
    expect(refresh).toContain('Max-Age=604800');

    // Readable by design — the browser client copies this into X-CSRF-Token.
    expect(csrf).not.toContain('HttpOnly');
    expect(refresh).toContain('HttpOnly');

    // The rest of the policy is untouched and shared with the token cookies.
    expect(csrf).toContain('Path=/');
    expect(csrf).toContain('SameSite=Lax');
  });

  it('should login successfully with username', async () => {
    const {
      response: { login }
    } = await AuthFactory.authenticated(app, { loginBy: 'username' });

    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']).toBeDefined();
    expect(login.headers['set-cookie'][0]).toContain('access_token');
    expect(login.headers['set-cookie'][1]).toContain('refresh_token');
  });

  it('should fail if email does not exist', async () => {
    const { user, client } = await UserFactory.register(app);

    const res = await client.post('/v1/auth/login', {
      body: { email: 'wrong@test.com', password: user.password }
    });

    expect(res.status).toBe(401);
  });

  it('should fail if password is wrong', async () => {
    const { user, client } = await UserFactory.register(app);

    const res = await client.post('/v1/auth/login', {
      body: { email: user.email, password: 'WrongPassword@123' }
    });

    expect(res.status).toBe(401);
  });

  it('should fail if password is empty', async () => {
    const { user, client } = await UserFactory.register(app);
    const res = await client.post('/v1/auth/login', {
      body: {
        email: user.email,
        password: null
      }
    });

    expect(res.status).toBe(422);
  });

  it('should fail if user not found by email or username', async () => {
    const { user, client } = await UserFactory.register(app);

    const res = await client.post('/v1/auth/login', {
      body: {
        email: 'unknown_value',
        password: user.password
      }
    });

    expect(res.status).toBe(401);
  });
});
