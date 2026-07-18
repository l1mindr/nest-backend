import { Session } from '@features/sessions/entities/session.entity';
import { User } from '@features/users/entities/user.entity';
import { INestApplication } from '@nestjs/common';
import { compare } from 'bcrypt';
import { DataSource } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { runMigrations, truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

const FAILURE_TRIGGER = 'fail_change_password_session_update';
const FAILURE_FUNCTION = 'fail_change_password_session_update';

describe('Auth Change Password (e2e) version: 1', () => {
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

  it('should update the password and revoke other sessions atomically', async () => {
    const context = await AuthFactory.authenticated(app);
    const current = await AuthFactory.login(context);

    const response = await current.client
      .post('/v1/auth/change-password', {
        body: {
          currentPassword: context.user.password,
          newPassword: 'NewPassword@123'
        }
      })
      .set('X-CSRF-Token', current.response.headers.xCsrfToken);

    expect(response.status).toBe(204);

    const user = await findUserWithPassword(context.user.email);
    const sessions = await findUserSessions(user.id);

    expect(await compare('NewPassword@123', user.password)).toBe(true);
    expect(sessions.filter((session) => session.isRevoked)).toHaveLength(1);
    expect(sessions.filter((session) => !session.isRevoked)).toHaveLength(1);
  });

  it('should roll back the password update when session revocation fails', async () => {
    const context = await AuthFactory.authenticated(app);
    const current = await AuthFactory.login(context);

    await createFailureTrigger();

    const response = await current.client
      .post('/v1/auth/change-password', {
        body: {
          currentPassword: context.user.password,
          newPassword: 'NewPassword@123'
        }
      })
      .set('X-CSRF-Token', current.response.headers.xCsrfToken);

    expect(response.status).toBe(500);

    const user = await findUserWithPassword(context.user.email);
    const sessions = await findUserSessions(user.id);

    expect(await compare(context.user.password, user.password)).toBe(true);
    expect(await compare('NewPassword@123', user.password)).toBe(false);
    expect(sessions.every((session) => !session.isRevoked)).toBe(true);
  });

  async function findUserWithPassword(email: string): Promise<User> {
    const user = await dataSource.getRepository(User).findOne({
      where: { email },
      select: { id: true, password: true }
    });

    if (!user) throw new Error(`Expected user ${email} to exist`);

    return user;
  }

  async function findUserSessions(userId: string): Promise<Session[]> {
    return dataSource.getRepository(Session).find({
      where: { owner: { id: userId } },
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
