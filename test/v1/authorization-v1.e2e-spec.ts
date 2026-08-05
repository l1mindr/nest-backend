import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { UserFactory } from '../factories/user.factory';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

/**
 * End-to-end coverage of the authorization model.
 *
 * The unit tests prove each rule in isolation; these prove that the wiring —
 * guards, decorators, use cases, database constraints — actually enforces them
 * over HTTP, which is where a misplaced decorator would show up and nowhere
 * else.
 */
describe('Authorization (e2e) version: 1', () => {
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

  /** State-changing routes are behind CSRF; reads are not. */
  const csrf = (context: AuthenticatedUserContext) => ({
    'x-csrf-token': context.response.headers.xCsrfToken
  });

  const owner = (overrides = {}) =>
    AuthFactory.authenticated(
      app,
      { withRole: UserRole.OWNER, overrides },
      dataSource
    );

  const admin = (permissions: Permission[], overrides = {}) =>
    AuthFactory.authenticated(
      app,
      { withRole: UserRole.ADMIN, withPermissions: permissions, overrides },
      dataSource
    );

  const plainUser = (overrides = {}) =>
    AuthFactory.authenticated(app, { overrides });

  const otherUser = (suffix: string) => ({
    email: `other${suffix}@test.com`,
    username: `other${suffix}`,
    password: 'Password@123'
  });

  const findByEmail = (email: string) =>
    dataSource.getRepository(User).findOneOrFail({ where: { email } });

  describe('owner bypass', () => {
    it('should let the owner reach a route without holding the permission', async () => {
      const context = await owner();

      // The owner has no grant rows at all.
      const res = await context.client.get('/v1/admin/users');

      expect(res.status).toBe(200);
    });

    it('should report the owner as holding every permission', async () => {
      const context = await owner();

      const res = await context.client.get('/v1/admin/permissions/me');

      expect(res.status).toBe(200);
      expect(res.body.role).toBe(UserRole.OWNER);
      expect(res.body.permissions).toEqual(
        expect.arrayContaining(Object.values(Permission))
      );
    });

    it('should let the owner through routes reserved to the owner', async () => {
      const context = await owner();

      const res = await context.client.get('/v1/admin/admins');

      expect(res.status).toBe(200);
    });
  });

  describe('owner uniqueness and immutability', () => {
    it('should refuse to promote anyone to owner, since no endpoint accepts a role', async () => {
      const ownerContext = await owner();
      const target = await UserFactory.register(app, otherUser('1'));
      await UserFactory.verifyEmail(app, target.user.email);
      const targetUser = await findByEmail(target.user.email);

      const res = await ownerContext.client.post('/v1/admin/admins', {
        headers: csrf(ownerContext),
        body: { userId: targetUser.id, role: UserRole.OWNER }
      });

      // `role` is not a member of the DTO, so the body is rejected outright.
      expect(res.status).toBe(422);

      const stored = await findByEmail(target.user.email);
      expect(stored.role).toBe(UserRole.USER);
    });

    it('should refuse a second owner at the database level', async () => {
      await owner();
      const second = await UserFactory.register(app, otherUser('2'));

      await expect(
        dataSource
          .getRepository(User)
          .update({ email: second.user.email }, { role: UserRole.OWNER })
      ).rejects.toThrow();
    });

    it('should refuse to suspend the owner', async () => {
      const ownerContext = await owner();
      const adminContext = await admin(
        [Permission.USER_SUSPEND],
        otherUser('3')
      );
      const ownerUser = await findByEmail(ownerContext.user.email);

      const res = await adminContext.client.post(
        `/v1/admin/users/${ownerUser.id}/suspend`,
        {
          headers: csrf(adminContext),
          body: { reason: 'attempting to suspend the owner' }
        }
      );

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OWNER_IMMUTABLE');

      const stored = await findByEmail(ownerContext.user.email);
      expect(stored.status).toBe(UserStatus.ACTIVATE);
    });

    it('should refuse to withdraw the owner role', async () => {
      const ownerContext = await owner();
      const ownerUser = await findByEmail(ownerContext.user.email);

      const res = await ownerContext.client.delete(
        `/v1/admin/admins/${ownerUser.id}`,
        { headers: csrf(ownerContext) }
      );

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OWNER_IMMUTABLE');
    });

    it('should refuse to delete the owner account', async () => {
      const ownerContext = await owner();

      const res = await ownerContext.client.delete('/v1/user/delete-account', {
        headers: csrf(ownerContext)
      });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OWNER_IMMUTABLE');
    });

    it('should still let the owner update their own profile', async () => {
      const ownerContext = await owner();

      const res = await ownerContext.client.put('/v1/user', {
        headers: csrf(ownerContext),
        body: { name: 'The Owner' }
      });

      expect(res.status).toBe(204);
    });
  });

  describe('administrator archetypes', () => {
    it('should let a read-only administrator read but not suspend', async () => {
      const context = await admin([Permission.USER_READ]);
      const victim = await plainUser(otherUser('4'));
      const victimUser = await findByEmail(victim.user.email);

      await expect(
        context.client.get('/v1/admin/users').then((r) => r.status)
      ).resolves.toBe(200);

      const suspend = await context.client.post(
        `/v1/admin/users/${victimUser.id}/suspend`,
        { headers: csrf(context), body: { reason: 'no permission for this' } }
      );

      expect(suspend.status).toBe(403);
      expect(suspend.body.error.code).toBe('ACCESS_DENIED');
    });

    it('should let a moderator read and suspend', async () => {
      const context = await admin([
        Permission.USER_READ,
        Permission.USER_SUSPEND
      ]);
      const victim = await plainUser(otherUser('5'));
      const victimUser = await findByEmail(victim.user.email);

      const suspend = await context.client.post(
        `/v1/admin/users/${victimUser.id}/suspend`,
        { headers: csrf(context), body: { reason: 'policy violation' } }
      );

      expect(suspend.status).toBe(204);

      const stored = await findByEmail(victim.user.email);
      expect(stored.status).toBe(UserStatus.SUSPEND);
    });

    it('should refuse a moderator the unsuspend route they were not granted', async () => {
      const context = await admin([
        Permission.USER_READ,
        Permission.USER_SUSPEND
      ]);
      const victim = await plainUser(otherUser('6'));
      const victimUser = await findByEmail(victim.user.email);

      await context.client.post(`/v1/admin/users/${victimUser.id}/suspend`, {
        headers: csrf(context),
        body: { reason: 'policy violation' }
      });

      const unsuspend = await context.client.patch(
        `/v1/admin/users/${victimUser.id}/unsuspend`,
        { headers: csrf(context) }
      );

      expect(unsuspend.status).toBe(403);
    });

    it('should refuse an administrator holding no permissions at all', async () => {
      const context = await admin([]);

      const res = await context.client.get('/v1/admin/users');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCESS_DENIED');
    });

    it('should report exactly what an administrator holds', async () => {
      const context = await admin([
        Permission.USER_READ,
        Permission.USER_UPDATE
      ]);

      const res = await context.client.get('/v1/admin/permissions/me');

      expect(res.status).toBe(200);
      expect(res.body.role).toBe(UserRole.ADMIN);
      expect(res.body.permissions.sort()).toEqual(
        [Permission.USER_READ, Permission.USER_UPDATE].sort()
      );
    });
  });

  describe('ordinary users', () => {
    it('should keep the existing behaviour: no access to admin routes', async () => {
      const context = await plainUser();

      const res = await context.client.get('/v1/admin/users');

      expect(res.status).toBe(403);
    });

    it('should report an empty permission set', async () => {
      const context = await plainUser();

      const res = await context.client.get('/v1/admin/permissions/me');

      expect(res.status).toBe(200);
      expect(res.body.role).toBe(UserRole.USER);
      expect(res.body.permissions).toEqual([]);
    });

    it('should still reach its own profile', async () => {
      const context = await plainUser();

      const res = await context.client.get('/v1/user/me');

      expect(res.status).toBe(200);
      expect(res.body.role).toBe(UserRole.USER);
    });
  });

  describe('administrator lifecycle', () => {
    it('should let the owner promote an active account with permissions', async () => {
      const ownerContext = await owner();
      const target = await plainUser(otherUser('7'));
      const targetUser = await findByEmail(target.user.email);

      const res = await ownerContext.client.post('/v1/admin/admins', {
        headers: csrf(ownerContext),
        body: {
          userId: targetUser.id,
          permissions: [Permission.USER_READ]
        }
      });

      expect(res.status).toBe(201);
      expect(res.body.role).toBe(UserRole.ADMIN);
      expect(res.body.permissions).toEqual([Permission.USER_READ]);
    });

    it('should refuse an administrator creating another administrator', async () => {
      const adminContext = await admin(Object.values(Permission));
      const target = await plainUser(otherUser('8'));
      const targetUser = await findByEmail(target.user.email);

      const res = await adminContext.client.post('/v1/admin/admins', {
        headers: csrf(adminContext),
        body: { userId: targetUser.id }
      });

      // Owner-only by role: no permission set unlocks this.
      expect(res.status).toBe(403);

      const stored = await findByEmail(target.user.email);
      expect(stored.role).toBe(UserRole.USER);
    });

    it('should refuse to promote an unverified account', async () => {
      const ownerContext = await owner();
      const target = await UserFactory.register(app, otherUser('9'));
      const targetUser = await findByEmail(target.user.email);

      const res = await ownerContext.client.post('/v1/admin/admins', {
        headers: csrf(ownerContext),
        body: { userId: targetUser.id }
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_ELIGIBLE');
    });

    it('should withdraw the role, purge the grants and end the sessions', async () => {
      const ownerContext = await owner();
      const adminContext = await admin([Permission.USER_READ], otherUser('10'));
      const adminUser = await findByEmail(adminContext.user.email);

      const res = await ownerContext.client.delete(
        `/v1/admin/admins/${adminUser.id}`,
        { headers: csrf(ownerContext) }
      );

      expect(res.status).toBe(204);

      const stored = await findByEmail(adminContext.user.email);
      expect(stored.role).toBe(UserRole.USER);

      // The access token predates the demotion; the session behind it is gone.
      const after = await adminContext.client.get('/v1/admin/users');
      expect(after.status).toBe(401);
    });

    it('should let the owner deactivate and reactivate an administrator', async () => {
      const ownerContext = await owner();
      const adminContext = await admin([Permission.USER_READ], otherUser('11'));
      const adminUser = await findByEmail(adminContext.user.email);

      const deactivate = await ownerContext.client.post(
        `/v1/admin/admins/${adminUser.id}/deactivate`,
        { headers: csrf(ownerContext) }
      );
      expect(deactivate.status).toBe(204);
      expect((await findByEmail(adminContext.user.email)).status).toBe(
        UserStatus.DEACTIVATE
      );

      const activate = await ownerContext.client.post(
        `/v1/admin/admins/${adminUser.id}/activate`,
        { headers: csrf(ownerContext) }
      );
      expect(activate.status).toBe(204);
      expect((await findByEmail(adminContext.user.email)).status).toBe(
        UserStatus.ACTIVATE
      );
    });
  });

  describe('privilege escalation', () => {
    it('should refuse an administrator granting permissions to themselves', async () => {
      const context = await admin([
        Permission.ROLE_ASSIGN,
        Permission.USER_READ
      ]);
      const self = await findByEmail(context.user.email);

      const res = await context.client.post(
        `/v1/admin/admins/${self.id}/permissions`,
        {
          headers: csrf(context),
          body: { permissions: [Permission.USER_READ] }
        }
      );

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SELF_MANAGEMENT_FORBIDDEN');
    });

    it('should refuse an administrator passing on a permission they do not hold', async () => {
      const granter = await admin([Permission.ROLE_ASSIGN]);
      const receiver = await admin([Permission.USER_READ], otherUser('12'));
      const receiverUser = await findByEmail(receiver.user.email);

      const res = await granter.client.post(
        `/v1/admin/admins/${receiverUser.id}/permissions`,
        {
          headers: csrf(granter),
          body: { permissions: [Permission.SYSTEM_SETTINGS] }
        }
      );

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PERMISSION_NOT_HELD');
    });

    it('should refuse permission management without ROLE_ASSIGN', async () => {
      const granter = await admin([
        Permission.USER_READ,
        Permission.USER_SUSPEND
      ]);
      const receiver = await admin([Permission.USER_READ], otherUser('13'));
      const receiverUser = await findByEmail(receiver.user.email);

      const res = await granter.client.post(
        `/v1/admin/admins/${receiverUser.id}/permissions`,
        {
          headers: csrf(granter),
          body: { permissions: [Permission.USER_SUSPEND] }
        }
      );

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCESS_DENIED');
    });

    it('should refuse an administrator editing the owner', async () => {
      const ownerContext = await owner();
      const adminContext = await admin(
        [Permission.ADMIN_UPDATE],
        otherUser('14')
      );
      const ownerUser = await findByEmail(ownerContext.user.email);

      const res = await adminContext.client.patch(
        `/v1/admin/admins/${ownerUser.id}`,
        { headers: csrf(adminContext), body: { name: 'Not The Owner' } }
      );

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OWNER_IMMUTABLE');
    });

    it('should reject an unknown permission code before it reaches the grant table', async () => {
      const ownerContext = await owner();
      const receiver = await admin([Permission.USER_READ], otherUser('15'));
      const receiverUser = await findByEmail(receiver.user.email);

      const res = await ownerContext.client.post(
        `/v1/admin/admins/${receiverUser.id}/permissions`,
        {
          headers: csrf(ownerContext),
          body: { permissions: ['NOT_A_PERMISSION'] }
        }
      );

      expect(res.status).toBe(422);
    });
  });

  describe('grant and revoke', () => {
    it('should take effect on the target’s very next request', async () => {
      const ownerContext = await owner();
      const target = await admin([], otherUser('16'));
      const targetUser = await findByEmail(target.user.email);

      expect((await target.client.get('/v1/admin/users')).status).toBe(403);

      const grant = await ownerContext.client.post(
        `/v1/admin/admins/${targetUser.id}/permissions`,
        {
          headers: csrf(ownerContext),
          body: { permissions: [Permission.USER_READ] }
        }
      );
      expect(grant.status).toBe(204);

      // No re-login: grants are read per request, not carried in the token.
      expect((await target.client.get('/v1/admin/users')).status).toBe(200);

      const revoke = await ownerContext.client.delete(
        `/v1/admin/admins/${targetUser.id}/permissions`,
        {
          headers: csrf(ownerContext),
          body: { permissions: [Permission.USER_READ] }
        }
      );
      expect(revoke.status).toBe(204);

      expect((await target.client.get('/v1/admin/users')).status).toBe(403);
    });

    it('should treat a repeated grant as a no-op rather than an error', async () => {
      const ownerContext = await owner();
      const target = await admin([Permission.USER_READ], otherUser('17'));
      const targetUser = await findByEmail(target.user.email);

      const first = await ownerContext.client.post(
        `/v1/admin/admins/${targetUser.id}/permissions`,
        {
          headers: csrf(ownerContext),
          body: { permissions: [Permission.USER_READ] }
        }
      );
      const second = await ownerContext.client.post(
        `/v1/admin/admins/${targetUser.id}/permissions`,
        {
          headers: csrf(ownerContext),
          body: { permissions: [Permission.USER_READ] }
        }
      );

      expect(first.status).toBe(204);
      expect(second.status).toBe(204);

      const view = await ownerContext.client.get(
        `/v1/admin/admins/${targetUser.id}`
      );
      expect(view.body.permissions).toEqual([Permission.USER_READ]);
    });
  });

  describe('permission catalog', () => {
    it('should list every permission for an administrator who can read', async () => {
      const context = await admin([Permission.ADMIN_READ]);

      const res = await context.client.get('/v1/admin/permissions');

      expect(res.status).toBe(200);
      expect(
        res.body.items.map((p: { code: string }) => p.code).sort()
      ).toEqual(Object.values(Permission).sort());
      expect(res.body.items[0]).toEqual({
        code: expect.any(String),
        description: expect.any(String)
      });
    });

    it('should refuse the catalog to an ordinary user', async () => {
      const context = await plainUser();

      const res = await context.client.get('/v1/admin/permissions');

      expect(res.status).toBe(403);
    });
  });
});
