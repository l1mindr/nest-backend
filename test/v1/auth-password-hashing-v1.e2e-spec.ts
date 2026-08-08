import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { UserFactory } from '../factories/user.factory';
import { getInvitationToken, resetEmailStore } from '../helpers/email.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

const isArgon2id = (hash: string) => hash.startsWith('$argon2id$');

/**
 * The password hashing lifecycle end to end: new accounts are Argon2id,
 * legacy bcrypt accounts still sign in and are migrated in place, and every
 * password the system writes afterwards is Argon2id.
 */
describe('Auth password hashing (e2e) version: 1', () => {
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
    resetEmailStore();
  });

  afterAll(async () => {
    await app?.close();
  });

  const users = () => dataSource.getRepository(User);

  async function findUserWithPassword(email: string): Promise<User> {
    const user = await users().findOne({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, password: true }
    });

    if (!user) throw new Error(`Expected user ${email} to exist`);

    return user;
  }

  /** The migration runs off the request path, so wait for it to land. */
  async function waitForArgon2id(
    email: string,
    timeoutMs = 5000
  ): Promise<User> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const user = await findUserWithPassword(email);

      if (isArgon2id(user.password)) return user;

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error(
      `Password for ${email} was not migrated to Argon2id in time`
    );
  }

  describe('new accounts', () => {
    it('should store a registration password as Argon2id', async () => {
      const { user } = await UserFactory.register(app);
      await UserFactory.verifyEmail(app, user.email);

      const stored = await findUserWithPassword(user.email);

      expect(stored.password.startsWith('$argon2id$v=19$')).toBe(true);
      await expect(argon2.verify(stored.password, user.password)).resolves.toBe(
        true
      );
    });

    it('should never expose the password or its hash in API responses', async () => {
      const { user, client, response } = await UserFactory.register(app);
      await UserFactory.verifyEmail(app, user.email);

      expect(JSON.stringify(response.register.body)).not.toContain(
        user.password
      );

      const login = await client.post('/v1/auth/login', {
        body: { email: user.email, password: user.password }
      });
      const loginBody = JSON.stringify(login.body);

      expect(loginBody).not.toContain('password');
      expect(loginBody).not.toContain('$argon2id');
      expect(loginBody).not.toContain('$2b$');
    });

    it('should authenticate a newly registered user', async () => {
      const context = await AuthFactory.authenticated(app);

      expect(context.response.login.status).toBe(200);
    });
  });

  describe('legacy bcrypt accounts', () => {
    it('should authenticate a legacy bcrypt password', async () => {
      const context = await UserFactory.createWithBcryptPassword(
        app,
        dataSource
      );

      const stored = await findUserWithPassword(context.user.email);
      expect(stored.password).toMatch(/^\$2[abxy]\$/);

      const login = await context.client.post('/v1/auth/login', {
        body: { email: context.user.email, password: context.user.password }
      });

      expect(login.status).toBe(200);
    });

    it('should migrate a legacy bcrypt hash to Argon2id after a successful login', async () => {
      const context = await UserFactory.createWithBcryptPassword(
        app,
        dataSource
      );

      const before = await findUserWithPassword(context.user.email);
      expect(before.password).toMatch(/^\$2[abxy]\$/);

      const login = await context.client.post('/v1/auth/login', {
        body: { email: context.user.email, password: context.user.password }
      });
      expect(login.status).toBe(200);

      const migrated = await waitForArgon2id(context.user.email);

      await expect(
        argon2.verify(migrated.password, context.user.password)
      ).resolves.toBe(true);
    });

    it('should keep authenticating with the same password after migration', async () => {
      const context = await UserFactory.createWithBcryptPassword(
        app,
        dataSource
      );

      const first = await context.client.post('/v1/auth/login', {
        body: { email: context.user.email, password: context.user.password }
      });
      expect(first.status).toBe(200);

      await waitForArgon2id(context.user.email);

      const second = await context.client.post('/v1/auth/login', {
        body: { email: context.user.email, password: context.user.password }
      });
      expect(second.status).toBe(200);
    });

    it('should not migrate when the password is wrong', async () => {
      const context = await UserFactory.createWithBcryptPassword(
        app,
        dataSource
      );

      const login = await context.client.post('/v1/auth/login', {
        body: { email: context.user.email, password: 'WrongPassword@123' }
      });
      expect(login.status).toBe(401);

      const stored = await findUserWithPassword(context.user.email);
      expect(stored.password).toMatch(/^\$2[abxy]\$/);
    });
  });

  describe('password change', () => {
    it('should store the new password as Argon2id and reject the old one', async () => {
      const context = await AuthFactory.authenticated(app);
      const current = await AuthFactory.login(context);

      const change = await current.client
        .post('/v1/auth/change-password', {
          body: {
            currentPassword: context.user.password,
            newPassword: 'NewPassword@123'
          }
        })
        .set('X-CSRF-Token', current.response.headers.xCsrfToken);

      expect(change.status).toBe(204);

      const stored = await findUserWithPassword(context.user.email);
      expect(isArgon2id(stored.password)).toBe(true);
      await expect(
        argon2.verify(stored.password, 'NewPassword@123')
      ).resolves.toBe(true);
      await expect(
        argon2.verify(stored.password, context.user.password)
      ).resolves.toBe(false);

      const oldLogin = await context.client.post('/v1/auth/login', {
        body: { email: context.user.email, password: context.user.password }
      });
      expect(oldLogin.status).toBe(401);

      const newLogin = await context.client.post('/v1/auth/login', {
        body: { email: context.user.email, password: 'NewPassword@123' }
      });
      expect(newLogin.status).toBe(200);
    });

    it('should write an Argon2id hash when a legacy bcrypt account changes its password', async () => {
      const context = await UserFactory.createWithBcryptPassword(
        app,
        dataSource
      );

      const login = await AuthFactory.login(context);
      expect(login.response.login.status).toBe(200);

      await waitForArgon2id(context.user.email);

      const change = await context.client
        .post('/v1/auth/change-password', {
          body: {
            currentPassword: context.user.password,
            newPassword: 'NewPassword@123'
          }
        })
        .set('X-CSRF-Token', login.response.headers.xCsrfToken);

      expect(change.status).toBe(204);

      const stored = await findUserWithPassword(context.user.email);
      expect(isArgon2id(stored.password)).toBe(true);
      await expect(
        argon2.verify(stored.password, 'NewPassword@123')
      ).resolves.toBe(true);
    });
  });

  describe('roles', () => {
    it('should store an ADMIN account password as Argon2id', async () => {
      const owner = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      const invite = await owner.client.post(
        '/v1/admin/administrators/invitations',
        {
          headers: { 'x-csrf-token': owner.response.headers.xCsrfToken },
          body: { email: 'invitee@test.com', permissions: ['USER_READ'] }
        }
      );
      expect(invite.status).toBe(201);

      const token = getInvitationToken('invitee@test.com');
      expect(token).toBeDefined();

      const accept = await owner.client.post(
        '/v1/admin/administrators/invitations/accept',
        {
          body: {
            token,
            username: 'invited_admin',
            password: 'Password@123',
            name: 'Invited Admin'
          }
        }
      );
      expect(accept.status).toBe(204);

      const stored = await findUserWithPassword('invitee@test.com');
      expect(isArgon2id(stored.password)).toBe(true);
      await expect(
        argon2.verify(stored.password, 'Password@123')
      ).resolves.toBe(true);
    });

    it('should store an OWNER account password as Argon2id', async () => {
      const context = await AuthFactory.authenticated(
        app,
        { withRole: UserRole.OWNER },
        dataSource
      );

      const stored = await findUserWithPassword(context.user.email);
      expect(isArgon2id(stored.password)).toBe(true);
    });
  });
});
