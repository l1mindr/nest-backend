import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { Role } from '@features/authorization/domain/entities/role.entity';
import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

const SYSTEM_ROLES: ReadonlyArray<Pick<Role, 'name' | 'description'>> = [
  { name: 'OWNER', description: 'The account that bypasses evaluation.' },
  { name: 'ADMIN', description: 'The administrator tier.' },
  { name: 'USER', description: 'The ordinary account tier.' }
];

async function seedSystemRoles(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Role);

  await repo.save(
    SYSTEM_ROLES.map((role) => repo.create({ ...role, isSystem: true }))
  );
}

/**
 * End-to-end coverage of the role catalog and role assignment — the second,
 * additive source of permissions layered on top of the direct-grant model
 * `authorization-v1.e2e-spec.ts` already covers.
 */
describe('Roles (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const ROLES = '/v1/admin/roles';

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } =
      await createMigratedTestApp();

    app = testApp;
    dataSource = testDataSource;
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
    // `role` is not a reference table like `permission`: tests create custom
    // rows in it, so it is truncated with everything else. The three system
    // rows the migration seeds have to be put back for every test, the same
    // way the migration puts them there for a fresh database.
    await seedSystemRoles(dataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

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
    email: `role-e2e-${suffix}@test.com`,
    username: `role_e2e_${suffix.replace(/-/g, '_')}`,
    password: 'Password@123'
  });

  const findByEmail = (email: string) =>
    dataSource.getRepository(User).findOneOrFail({
      where: { email },
      select: { id: true, email: true, role: true }
    });

  const findSystemRole = (name: 'OWNER' | 'ADMIN' | 'USER') =>
    dataSource.getRepository(Role).findOneOrFail({ where: { name } });

  const createRole = async (
    ownerContext: AuthenticatedUserContext,
    name: string,
    permissions: Permission[] = []
  ): Promise<string> => {
    const created = await ownerContext.client.post(ROLES, {
      headers: csrf(ownerContext),
      body: { name }
    });

    const roleId = created.body.id as string;

    if (permissions.length > 0) {
      await ownerContext.client.put(`${ROLES}/${roleId}/permissions`, {
        headers: csrf(ownerContext),
        body: { permissions }
      });
    }

    return roleId;
  };

  describe('authentication and authorization', () => {
    it('should refuse an unauthenticated request', async () => {
      const client = new ApiClient(app);

      const res = await client.get(ROLES);

      expect(res.status).toBe(401);
    });

    it('should refuse an ordinary user', async () => {
      const context = await plainUser();

      const res = await context.client.get(ROLES);

      expect(res.status).toBe(403);
    });

    it('should refuse an administrator without ROLE_READ, even holding other permissions', async () => {
      const context = await admin([Permission.USER_READ]);

      const res = await context.client.get(ROLES);

      expect(res.status).toBe(403);
    });
  });

  describe('role CRUD as the owner', () => {
    it('should list the three seeded system roles', async () => {
      const ownerContext = await owner();

      const res = await ownerContext.client.get(ROLES);

      expect(res.status).toBe(200);
      const names = res.body.items.map((r: { name: string }) => r.name).sort();
      expect(names).toEqual(['ADMIN', 'OWNER', 'USER']);
      expect(
        res.body.items.every((r: { isSystem: boolean }) => r.isSystem === true)
      ).toBe(true);
    });

    it('should create a role with no permissions', async () => {
      const ownerContext = await owner();

      const res = await ownerContext.client.post(ROLES, {
        headers: csrf(ownerContext),
        body: { name: 'SUPPORT', description: 'Read-only support access.' }
      });

      expect(res.status).toBe(201);
      expect(res.body.isSystem).toBe(false);
      expect(res.body.permissions).toEqual([]);
    });

    it('should refuse a duplicate role name', async () => {
      const ownerContext = await owner();
      await createRole(ownerContext, 'SUPPORT');

      const res = await ownerContext.client.post(ROLES, {
        headers: csrf(ownerContext),
        body: { name: 'SUPPORT' }
      });

      expect(res.status).toBe(409);
    });

    it('should rename a custom role and replace its permissions', async () => {
      const ownerContext = await owner();
      const roleId = await createRole(ownerContext, 'SUPPORT');

      const rename = await ownerContext.client.patch(`${ROLES}/${roleId}`, {
        headers: csrf(ownerContext),
        body: { name: 'SUPPORT_L1' }
      });
      expect(rename.status).toBe(204);

      const setPermissions = await ownerContext.client.put(
        `${ROLES}/${roleId}/permissions`,
        {
          headers: csrf(ownerContext),
          body: { permissions: [Permission.USER_READ] }
        }
      );
      expect(setPermissions.status).toBe(204);

      const view = await ownerContext.client.get(`${ROLES}/${roleId}`);
      expect(view.body.name).toBe('SUPPORT_L1');
      expect(view.body.permissions).toEqual([Permission.USER_READ]);
    });

    it('should delete a role with no assignments', async () => {
      const ownerContext = await owner();
      const roleId = await createRole(ownerContext, 'SUPPORT');

      const res = await ownerContext.client.delete(`${ROLES}/${roleId}`, {
        headers: csrf(ownerContext)
      });

      expect(res.status).toBe(204);
      expect((await ownerContext.client.get(`${ROLES}/${roleId}`)).status).toBe(
        404
      );
    });

    it('should reject an owner-reserved permission before it reaches a role', async () => {
      const ownerContext = await owner();
      const roleId = await createRole(ownerContext, 'SUPPORT');

      const res = await ownerContext.client.put(
        `${ROLES}/${roleId}/permissions`,
        {
          headers: csrf(ownerContext),
          body: { permissions: [Permission.ADMIN_READ] }
        }
      );

      expect(res.status).toBe(422);
    });
  });

  describe('system role protection', () => {
    it('should refuse to rename a system role', async () => {
      const ownerContext = await owner();
      const adminRole = await findSystemRole('ADMIN');

      const res = await ownerContext.client.patch(`${ROLES}/${adminRole.id}`, {
        headers: csrf(ownerContext),
        body: { name: 'NOT_ADMIN' }
      });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ROLE_PROTECTED');
    });

    it('should refuse to change the permissions of a system role', async () => {
      const ownerContext = await owner();
      const userRole = await findSystemRole('USER');

      const res = await ownerContext.client.put(
        `${ROLES}/${userRole.id}/permissions`,
        {
          headers: csrf(ownerContext),
          body: { permissions: [Permission.USER_READ] }
        }
      );

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ROLE_PROTECTED');
    });

    it('should refuse to delete a system role', async () => {
      const ownerContext = await owner();
      const userRole = await findSystemRole('USER');

      const res = await ownerContext.client.delete(`${ROLES}/${userRole.id}`, {
        headers: csrf(ownerContext)
      });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ROLE_PROTECTED');
    });
  });

  describe('role assignment', () => {
    it('should assign a role and grant its permissions on the target’s very next request', async () => {
      const ownerContext = await owner();
      const target = await admin([], otherUser('assign-1'));
      const targetUser = await findByEmail(target.user.email);
      const roleId = await createRole(ownerContext, 'READ_ONLY', [
        Permission.USER_READ
      ]);

      expect((await target.client.get('/v1/admin/users')).status).toBe(403);

      const assign = await ownerContext.client.post(
        `/v1/admin/users/${targetUser.id}/roles/${roleId}`,
        { headers: csrf(ownerContext) }
      );
      expect(assign.status).toBe(204);

      expect((await target.client.get('/v1/admin/users')).status).toBe(200);

      const unassign = await ownerContext.client.delete(
        `/v1/admin/users/${targetUser.id}/roles/${roleId}`,
        { headers: csrf(ownerContext) }
      );
      expect(unassign.status).toBe(204);

      expect((await target.client.get('/v1/admin/users')).status).toBe(403);
    });

    it('should treat a repeated assignment as a no-op rather than an error', async () => {
      const ownerContext = await owner();
      const target = await admin([], otherUser('assign-2'));
      const targetUser = await findByEmail(target.user.email);
      const roleId = await createRole(ownerContext, 'READ_ONLY_2', [
        Permission.USER_READ
      ]);

      const first = await ownerContext.client.post(
        `/v1/admin/users/${targetUser.id}/roles/${roleId}`,
        { headers: csrf(ownerContext) }
      );
      const second = await ownerContext.client.post(
        `/v1/admin/users/${targetUser.id}/roles/${roleId}`,
        { headers: csrf(ownerContext) }
      );

      expect(first.status).toBe(204);
      expect(second.status).toBe(204);

      const roles = await ownerContext.client.get(
        `/v1/admin/users/${targetUser.id}/roles`
      );
      expect(roles.body.items).toHaveLength(1);
    });

    it('should union permissions from more than one assigned role', async () => {
      const ownerContext = await owner();
      const target = await admin([], otherUser('assign-3'));
      const targetUser = await findByEmail(target.user.email);
      const readerRole = await createRole(ownerContext, 'READER', [
        Permission.USER_READ
      ]);
      const suspenderRole = await createRole(ownerContext, 'SUSPENDER', [
        Permission.USER_SUSPEND
      ]);

      await ownerContext.client.post(
        `/v1/admin/users/${targetUser.id}/roles/${readerRole}`,
        { headers: csrf(ownerContext) }
      );
      await ownerContext.client.post(
        `/v1/admin/users/${targetUser.id}/roles/${suspenderRole}`,
        { headers: csrf(ownerContext) }
      );

      const victim = await plainUser(otherUser('assign-3-victim'));
      const victimUser = await findByEmail(victim.user.email);

      expect((await target.client.get('/v1/admin/users')).status).toBe(200);

      const suspend = await target.client.post(
        `/v1/admin/users/${victimUser.id}/suspend`,
        { headers: csrf(target), body: { reason: 'policy violation' } }
      );
      expect(suspend.status).toBe(204);
    });

    it('should union a role grant with a direct grant', async () => {
      const ownerContext = await owner();
      const target = await admin(
        [Permission.USER_SUSPEND],
        otherUser('assign-4')
      );
      const targetUser = await findByEmail(target.user.email);
      const readerRole = await createRole(ownerContext, 'READER_2', [
        Permission.USER_READ
      ]);

      await ownerContext.client.post(
        `/v1/admin/users/${targetUser.id}/roles/${readerRole}`,
        { headers: csrf(ownerContext) }
      );

      expect((await target.client.get('/v1/admin/users')).status).toBe(200);

      const mine = await target.client.get('/v1/admin/permissions/me');
      expect(mine.body.permissions.sort()).toEqual(
        [Permission.USER_READ, Permission.USER_SUSPEND].sort()
      );
    });

    it('should refuse to assign a role to the owner', async () => {
      const ownerContext = await owner();
      const ownerUser = await findByEmail(ownerContext.user.email);
      const roleId = await createRole(ownerContext, 'READ_ONLY_3', [
        Permission.USER_READ
      ]);

      const res = await ownerContext.client.post(
        `/v1/admin/users/${ownerUser.id}/roles/${roleId}`,
        { headers: csrf(ownerContext) }
      );

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OWNER_IMMUTABLE');
    });

    it('should refuse the owner assigning a role to themselves', async () => {
      const ownerContext = await owner();
      const ownerUser = await findByEmail(ownerContext.user.email);
      const roleId = await createRole(ownerContext, 'READ_ONLY_4');

      const res = await ownerContext.client.post(
        `/v1/admin/users/${ownerUser.id}/roles/${roleId}`,
        { headers: csrf(ownerContext) }
      );

      // The owner check is asserted first, so a self-target that is also the
      // owner is refused as OWNER_IMMUTABLE rather than self-management.
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OWNER_IMMUTABLE');
    });

    it('should refuse to delete a role that still has an assignment', async () => {
      const ownerContext = await owner();
      const target = await admin([], otherUser('assign-5'));
      const targetUser = await findByEmail(target.user.email);
      const roleId = await createRole(ownerContext, 'READ_ONLY_5', [
        Permission.USER_READ
      ]);

      await ownerContext.client.post(
        `/v1/admin/users/${targetUser.id}/roles/${roleId}`,
        { headers: csrf(ownerContext) }
      );

      const res = await ownerContext.client.delete(`${ROLES}/${roleId}`, {
        headers: csrf(ownerContext)
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ROLE_HAS_ASSIGNMENTS');
    });
  });

  describe('cross-user isolation', () => {
    it('should refuse an administrator, lacking ROLE_READ, reading another account’s roles', async () => {
      const context = await admin([Permission.USER_READ]);
      const other = await plainUser(otherUser('idor-1'));
      const otherUserRow = await findByEmail(other.user.email);

      const res = await context.client.get(
        `/v1/admin/users/${otherUserRow.id}/roles`
      );

      expect(res.status).toBe(403);
    });

    it('should scope the roles listing to exactly the requested account', async () => {
      const ownerContext = await owner();
      const targetA = await admin([], otherUser('idor-2a'));
      const targetB = await admin([], otherUser('idor-2b'));
      const userA = await findByEmail(targetA.user.email);
      const userB = await findByEmail(targetB.user.email);
      const roleId = await createRole(ownerContext, 'READ_ONLY_6');

      await ownerContext.client.post(
        `/v1/admin/users/${userA.id}/roles/${roleId}`,
        { headers: csrf(ownerContext) }
      );

      const rolesForB = await ownerContext.client.get(
        `/v1/admin/users/${userB.id}/roles`
      );

      expect(rolesForB.status).toBe(200);
      expect(rolesForB.body.items).toEqual([]);
    });
  });
});
