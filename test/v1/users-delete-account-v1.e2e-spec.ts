import { Session } from '@features/sessions/entities/session.entity';
import { User } from '@features/users/entities/user.entity';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { runMigrations, truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import {
  getCookie,
  getCookieValue,
  normalizeHeader
} from '../utils/cookie.util';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

type SecondDevice = {
  client: ApiClient;
  refreshToken: string;
  csrfToken: string;
  xCsrfToken: string;
};

const FAILURE_TRIGGER = 'fail_delete_account_session_update';
const FAILURE_FUNCTION = 'fail_delete_account_session_update';

describe('Users Delete Account (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } = await createTestApp();
    await runMigrations(testDataSource);

    app = testApp;
    dataSource = testDataSource;
  });

  beforeEach(async () => {
    await dropFailureTrigger();
    await truncateDatabase(dataSource);
    await clearRedis(app);
  });

  afterEach(async () => {
    await dropFailureTrigger();
  });

  afterAll(async () => {
    await app.close();
  });

  const deleteAccount = (context: AuthenticatedUserContext) => {
    const {
      cookies: { refreshToken, csrfToken },
      headers: { xCsrfToken }
    } = context.response;

    return context.client
      .delete('/v1/user/delete-account')
      .set('Cookie', `${refreshToken}; ${csrfToken}`)
      .set('X-CSRF-Token', xCsrfToken);
  };

  const refreshWith = (context: AuthenticatedUserContext) => {
    const {
      cookies: { refreshToken, csrfToken },
      headers: { xCsrfToken }
    } = context.response;

    return request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', `${refreshToken}; ${csrfToken}`)
      .set('X-CSRF-Token', xCsrfToken);
  };

  /**
   * Log the same user in from a separate ApiClient (own cookie jar), so the
   * second session's cookies don't clobber the first client's.
   */
  const loginSecondDevice = async (
    context: AuthenticatedUserContext
  ): Promise<SecondDevice> => {
    const client = new ApiClient(app);

    const login = await client.post('/v1/auth/login', {
      body: {
        email: context.user.email,
        password: context.user.password
      }
    });

    expect(login.status).toBe(200);

    const cookies = normalizeHeader(login.headers['set-cookie']);

    return {
      client,
      refreshToken: getCookie(cookies, 'refresh_token'),
      csrfToken: getCookie(cookies, 'csrf_token'),
      xCsrfToken: getCookieValue(cookies, 'csrf_token')
    };
  };

  it('should soft delete the user and keep the row recoverable', async () => {
    const context = await AuthFactory.authenticated(app);

    const res = await deleteAccount(context);
    expect(res.status).toBe(204);

    const user = await findUserWithDeleted(context.user.email);
    expect(user.registryDates.deleteAt).not.toBeNull();
  });

  it('should revoke all session records on deletion', async () => {
    const context = await AuthFactory.authenticated(app);
    // A second device session for the same user
    await loginSecondDevice(context);

    const res = await deleteAccount(context);
    expect(res.status).toBe(204);

    const sessions = await findUserSessions(context.user.email);
    expect(sessions).toHaveLength(2);
    expect(sessions.every((session) => session.isRevoked)).toBe(true);
  });

  it('should reject existing access tokens after deletion', async () => {
    const context = await AuthFactory.authenticated(app);

    const before = await context.client.get('/v1/user/me');
    expect(before.status).toBe(200);

    const res = await deleteAccount(context);
    expect(res.status).toBe(204);

    // Same client, same access_token cookie issued at login
    const after = await context.client.get('/v1/user/me');
    expect(after.status).toBe(401);
  });

  it('should reject access tokens of other sessions after deletion', async () => {
    const context = await AuthFactory.authenticated(app);
    const otherDevice = await loginSecondDevice(context);

    const before = await otherDevice.client.get('/v1/user/me');
    expect(before.status).toBe(200);

    const res = await deleteAccount(context);
    expect(res.status).toBe(204);

    const after = await otherDevice.client.get('/v1/user/me');
    expect(after.status).toBe(401);
  });

  it('should reject refresh tokens after deletion', async () => {
    const context = await AuthFactory.authenticated(app);

    const res = await deleteAccount(context);
    expect(res.status).toBe(204);

    const refreshAttempt = await refreshWith(context);
    expect(refreshAttempt.status).toBe(401);
  });

  it('should reject refresh tokens of other sessions after deletion', async () => {
    const context = await AuthFactory.authenticated(app);
    const otherDevice = await loginSecondDevice(context);

    const res = await deleteAccount(context);
    expect(res.status).toBe(204);

    const refreshAttempt = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .set('Cookie', `${otherDevice.refreshToken}; ${otherDevice.csrfToken}`)
      .set('X-CSRF-Token', otherDevice.xCsrfToken);

    expect(refreshAttempt.status).toBe(401);
  });

  it('should not allow the deleted user to log in again', async () => {
    const context = await AuthFactory.authenticated(app);

    const res = await deleteAccount(context);
    expect(res.status).toBe(204);

    const login = await context.client.post('/v1/auth/login', {
      body: {
        email: context.user.email,
        password: context.user.password
      }
    });

    expect(login.status).toBe(401);
  });

  it('should roll back the soft delete when session revocation fails', async () => {
    const context = await AuthFactory.authenticated(app);

    await createFailureTrigger();

    const res = await deleteAccount(context);
    expect(res.status).toBe(500);

    const user = await findUserWithDeleted(context.user.email);
    expect(user.registryDates.deleteAt).toBeNull();

    const sessions = await findUserSessions(context.user.email);
    expect(sessions.every((session) => !session.isRevoked)).toBe(true);

    // The account must remain fully usable after the failed attempt
    const profile = await context.client.get('/v1/user/me');
    expect(profile.status).toBe(200);
  });

  async function findUserWithDeleted(email: string): Promise<User> {
    const user = await dataSource.getRepository(User).findOne({
      where: { email },
      withDeleted: true
    });

    if (!user) throw new Error(`Expected user ${email} to exist`);

    return user;
  }

  async function findUserSessions(email: string): Promise<Session[]> {
    const user = await findUserWithDeleted(email);

    return dataSource.getRepository(Session).find({
      where: { owner: { id: user.id } },
      withDeleted: true,
      order: { createdAt: 'ASC' }
    });
  }

  async function createFailureTrigger(): Promise<void> {
    await dataSource.query(`
      CREATE FUNCTION ${FAILURE_FUNCTION}()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'forced session revocation failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(`
      CREATE TRIGGER ${FAILURE_TRIGGER}
      BEFORE UPDATE ON "session"
      FOR EACH ROW
      EXECUTE FUNCTION ${FAILURE_FUNCTION}()
    `);
  }

  async function dropFailureTrigger(): Promise<void> {
    if (!dataSource) return;

    await dataSource.query(
      `DROP TRIGGER IF EXISTS ${FAILURE_TRIGGER} ON "session"`
    );
    await dataSource.query(`DROP FUNCTION IF EXISTS ${FAILURE_FUNCTION}()`);
  }
});
