import { AdminInvitation } from '@features/authorization/domain/entities/admin-invitation.entity';
import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { DELEGABLE_PERMISSIONS } from '@features/authorization/domain/permission.catalog';
import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import {
  getInvitationEmailCount,
  getInvitationToken,
  getInvitationTtlHours,
  resetEmailStore
} from '../helpers/email.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

/**
 * The administrator invitation flow, and the isolation and visibility rules it
 * exists to serve.
 *
 * The unit tests prove each rule against mocks; these prove the flow end to end
 * — that the token really only reaches the mailbox, that acceptance really is
 * the only thing that creates the account, and that an administrator really
 * cannot see the owner or their peers over HTTP.
 */
describe('Admin invitations (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const ADMINS = '/v1/admin/administrators';
  const INVITATIONS = `${ADMINS}/invitations`;
  const ACCEPT = `${INVITATIONS}/accept`;

  const INVITEE = 'invitee@test.com';

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

  const users = () => dataSource.getRepository(User);
  const invitations = () => dataSource.getRepository(AdminInvitation);

  const findByEmail = (email: string) =>
    users().findOneOrFail({ where: { email } });

  /** Issues an invitation and returns the token as delivered to the mailbox. */
  const invite = async (
    context: AuthenticatedUserContext,
    email = INVITEE,
    permissions: Permission[] = [Permission.USER_READ]
  ) => {
    const res = await context.client.post(INVITATIONS, {
      headers: csrf(context),
      body: { email, permissions }
    });

    return { res, token: getInvitationToken(email) };
  };

  const acceptBody = (token: string, overrides = {}) => ({
    token,
    username: 'invited_admin',
    password: 'Password@123',
    name: 'Invited Admin',
    ...overrides
  });

  describe('issuing an invitation', () => {
    it('should let the owner invite an administrator', async () => {
      const ownerContext = await owner();

      const { res, token } = await invite(ownerContext);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          email: INVITEE,
          status: 'PENDING',
          permissions: [Permission.USER_READ]
        })
      );
      expect(token).toEqual(expect.any(String));
      expect(getInvitationTtlHours(INVITEE)).toBe(48);
    });

    /**
     * The premise of replacing promotion: until the invitation is accepted
     * there is no account, so a revoked or forgotten invitation leaves nothing
     * that can be signed into.
     */
    it('should not create any account when the invitation is issued', async () => {
      const ownerContext = await owner();

      await invite(ownerContext);

      await expect(
        users().findOne({ where: { email: INVITEE } })
      ).resolves.toBeNull();
    });

    /** A database dump must yield nothing an attacker could present. */
    it('should store only the digest of the token', async () => {
      const ownerContext = await owner();

      const { token } = await invite(ownerContext);

      const stored = await invitations()
        .createQueryBuilder('i')
        .addSelect('i.tokenHash')
        .where('i.email = :email', { email: INVITEE })
        .getOneOrFail();

      expect(stored.tokenHash).toHaveLength(64);
      expect(stored.tokenHash).not.toBe(token);
    });

    it('should never return the token in the response body', async () => {
      const ownerContext = await owner();

      const { res, token } = await invite(ownerContext);

      expect(JSON.stringify(res.body)).not.toContain(token);
      expect(res.body).not.toHaveProperty('token');
      expect(res.body).not.toHaveProperty('tokenHash');
    });

    it('should refuse an address that already belongs to an account', async () => {
      const ownerContext = await owner();
      const existing = await plainUser(otherUser('1'));

      const { res } = await invite(ownerContext, existing.user.email);

      // The same 422 the registration path returns: an address that already
      // belongs to an account is a validation conflict, not a race.
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should supersede an outstanding invitation for the same address', async () => {
      const ownerContext = await owner();

      const first = await invite(ownerContext);
      const second = await invite(ownerContext);

      expect(second.res.status).toBe(201);
      expect(getInvitationEmailCount(INVITEE)).toBe(2);

      // The superseded token no longer works; the new one does.
      const stale = await new ApiClient(app).post(ACCEPT, {
        body: acceptBody(first.token!)
      });
      expect(stale.status).toBe(409);

      const fresh = await new ApiClient(app).post(ACCEPT, {
        body: acceptBody(second.token!, { username: 'fresh_admin' })
      });
      expect(fresh.status).toBe(204);
    });

    it('should refuse to invite with an owner-reserved permission', async () => {
      const ownerContext = await owner();

      const res = await ownerContext.client.post(INVITATIONS, {
        headers: csrf(ownerContext),
        body: { email: INVITEE, permissions: [Permission.ADMIN_INVITE] }
      });

      expect(res.status).toBe(422);
    });
  });

  describe('accepting an invitation', () => {
    it('should create an active administrator with the invited permissions', async () => {
      const ownerContext = await owner();
      const { token } = await invite(ownerContext, INVITEE, [
        Permission.USER_READ,
        Permission.USER_SUSPEND
      ]);

      const res = await new ApiClient(app).post(ACCEPT, {
        body: acceptBody(token!)
      });

      expect(res.status).toBe(204);

      const created = await findByEmail(INVITEE);
      expect(created.role).toBe(UserRole.ADMIN);
      expect(created.status).toBe(UserStatus.ACTIVATE);
      expect(created.username).toBe('invited_admin');
    });

    /** Receiving the token at the invited address is the verification. */
    it('should let the new administrator sign in immediately', async () => {
      const ownerContext = await owner();
      const { token } = await invite(ownerContext);

      await new ApiClient(app).post(ACCEPT, { body: acceptBody(token!) });

      const client = new ApiClient(app);
      const login = await client.post('/v1/auth/login', {
        body: { email: INVITEE, password: 'Password@123' }
      });

      expect(login.status).toBe(200);

      const users = await client.get('/v1/admin/users');
      expect(users.status).toBe(200);
    });

    /**
     * The email is never accepted from the client, and the field is not even
     * whitelisted: a request that tries to supply one is rejected wholesale, so
     * there is no path by which the account's address could be influenced by
     * the body. The address always comes from the invitation the token proves.
     */
    it('should not accept an email from the request body', async () => {
      const ownerContext = await owner();
      const { token } = await invite(ownerContext);

      const res = await new ApiClient(app).post(ACCEPT, {
        body: acceptBody(token!, { email: 'attacker@evil.com' })
      });

      expect(res.status).toBe(422);
      await expect(
        users().findOne({ where: { email: 'attacker@evil.com' } })
      ).resolves.toBeNull();
    });

    /** One-time use. */
    it('should refuse to reuse a token that was already accepted', async () => {
      const ownerContext = await owner();
      const { token } = await invite(ownerContext);

      const first = await new ApiClient(app).post(ACCEPT, {
        body: acceptBody(token!)
      });
      expect(first.status).toBe(204);

      const second = await new ApiClient(app).post(ACCEPT, {
        body: acceptBody(token!, { username: 'second_admin' })
      });

      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('INVITATION_NOT_PENDING');

      const admins = await users().find({ where: { role: UserRole.ADMIN } });
      expect(admins).toHaveLength(1);
    });

    it('should refuse a revoked invitation', async () => {
      const ownerContext = await owner();
      const { res, token } = await invite(ownerContext);

      const revoke = await ownerContext.client.delete(
        `${INVITATIONS}/${res.body.id}`,
        { headers: csrf(ownerContext) }
      );
      expect(revoke.status).toBe(204);

      const accept = await new ApiClient(app).post(ACCEPT, {
        body: acceptBody(token!)
      });

      expect(accept.status).toBe(409);
      expect(accept.body.error.code).toBe('INVITATION_NOT_PENDING');
      await expect(
        users().findOne({ where: { email: INVITEE } })
      ).resolves.toBeNull();
    });

    /** `410`, so a client can offer "ask for a new one" rather than "retry". */
    it('should refuse an expired invitation', async () => {
      const ownerContext = await owner();
      const { res, token } = await invite(ownerContext);

      await invitations().update(
        { id: res.body.id },
        { expiresAt: new Date(Date.now() - 1000) }
      );

      const accept = await new ApiClient(app).post(ACCEPT, {
        body: acceptBody(token!)
      });

      expect(accept.status).toBe(410);
      expect(accept.body.error.code).toBe('INVITATION_EXPIRED');
      await expect(
        users().findOne({ where: { email: INVITEE } })
      ).resolves.toBeNull();
    });

    /**
     * An unknown token and a wrong token give the same answer, so the endpoint
     * cannot be used to probe for live invitations.
     */
    it('should answer NOT_FOUND for a token that was never issued', async () => {
      const res = await new ApiClient(app).post(ACCEPT, {
        body: acceptBody('z'.repeat(43))
      });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INVITATION_NOT_FOUND');
    });

    it('should refuse a username that is already taken', async () => {
      const ownerContext = await owner();
      const existing = await plainUser(otherUser('2'));
      const { token } = await invite(ownerContext);

      const res = await new ApiClient(app).post(ACCEPT, {
        body: acceptBody(token!, { username: existing.user.username })
      });

      // The same 422 the registration path returns for a taken username.
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('USERNAME_ALREADY_EXISTS');
      await expect(
        users().findOne({ where: { email: INVITEE } })
      ).resolves.toBeNull();
    });

    it('should require no authentication', async () => {
      const ownerContext = await owner();
      const { token } = await invite(ownerContext);

      // A bare client: no cookies, no CSRF header.
      const res = await new ApiClient(app).post(ACCEPT, {
        body: acceptBody(token!)
      });

      expect(res.status).toBe(204);
    });
  });

  describe('revoking an invitation', () => {
    it('should keep the row so the audit trail survives', async () => {
      const ownerContext = await owner();
      const { res } = await invite(ownerContext);

      await ownerContext.client.delete(`${INVITATIONS}/${res.body.id}`, {
        headers: csrf(ownerContext)
      });

      const stored = await invitations().findOneOrFail({
        where: { id: res.body.id }
      });
      expect(stored.revokedAt).not.toBeNull();
    });

    it('should refuse revoking an already revoked invitation', async () => {
      const ownerContext = await owner();
      const { res } = await invite(ownerContext);

      await ownerContext.client.delete(`${INVITATIONS}/${res.body.id}`, {
        headers: csrf(ownerContext)
      });
      const second = await ownerContext.client.delete(
        `${INVITATIONS}/${res.body.id}`,
        { headers: csrf(ownerContext) }
      );

      expect(second.status).toBe(409);
    });

    it('should list settled invitations for the owner', async () => {
      const ownerContext = await owner();
      const { res } = await invite(ownerContext);

      await ownerContext.client.delete(`${INVITATIONS}/${res.body.id}`, {
        headers: csrf(ownerContext)
      });

      const list = await ownerContext.client.get(INVITATIONS);

      expect(list.status).toBe(200);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0].status).toBe('REVOKED');
    });
  });

  describe('owner-only administration', () => {
    /** Even a fully-granted administrator cannot manage administrators. */
    const everything = DELEGABLE_PERMISSIONS as Permission[];

    it('should refuse an administrator inviting another administrator', async () => {
      const adminContext = await admin(everything);

      const res = await adminContext.client.post(INVITATIONS, {
        headers: csrf(adminContext),
        body: { email: INVITEE }
      });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCESS_DENIED');
      await expect(invitations().find()).resolves.toHaveLength(0);
    });

    it('should refuse an administrator listing invitations', async () => {
      const adminContext = await admin(everything);

      expect((await adminContext.client.get(INVITATIONS)).status).toBe(403);
    });

    it('should refuse an administrator revoking an invitation', async () => {
      const ownerContext = await owner();
      const adminContext = await admin(everything, otherUser('3'));
      const { res } = await invite(ownerContext);

      const revoke = await adminContext.client.delete(
        `${INVITATIONS}/${res.body.id}`,
        { headers: csrf(adminContext) }
      );

      expect(revoke.status).toBe(403);
    });

    it('should refuse an administrator deleting another administrator', async () => {
      const adminContext = await admin(everything);
      const victim = await admin([], otherUser('4'));
      const victimUser = await findByEmail(victim.user.email);

      const res = await adminContext.client.delete(
        `${ADMINS}/${victimUser.id}`,
        { headers: csrf(adminContext) }
      );

      expect(res.status).toBe(403);
      await expect(findByEmail(victim.user.email)).resolves.toBeDefined();
    });

    it('should refuse an administrator editing another administrator', async () => {
      const adminContext = await admin(everything);
      const victim = await admin([], otherUser('5'));
      const victimUser = await findByEmail(victim.user.email);

      const res = await adminContext.client.patch(
        `${ADMINS}/${victimUser.id}`,
        { headers: csrf(adminContext), body: { name: 'Renamed' } }
      );

      expect(res.status).toBe(403);
    });

    it.each([
      ['suspend', 'post' as const],
      ['activate', 'post' as const],
      ['deactivate', 'post' as const]
    ])(
      'should refuse an administrator calling %s on another administrator',
      async (action, method) => {
        const adminContext = await admin(everything);
        const victim = await admin([], otherUser('6'));
        const victimUser = await findByEmail(victim.user.email);

        const res = await adminContext.client[method](
          `${ADMINS}/${victimUser.id}/${action}`,
          { headers: csrf(adminContext), body: { reason: 'trying it on' } }
        );

        expect(res.status).toBe(403);
        expect((await findByEmail(victim.user.email)).status).toBe(
          UserStatus.ACTIVATE
        );
      }
    );

    it('should refuse an administrator unsuspending another administrator', async () => {
      const adminContext = await admin(everything);
      const victim = await admin([], otherUser('7'));
      const victimUser = await findByEmail(victim.user.email);

      const res = await adminContext.client.patch(
        `${ADMINS}/${victimUser.id}/unsuspend`,
        { headers: csrf(adminContext) }
      );

      expect(res.status).toBe(403);
    });

    it('should refuse an administrator changing another administrator’s permissions', async () => {
      const adminContext = await admin(everything);
      const victim = await admin([], otherUser('8'));
      const victimUser = await findByEmail(victim.user.email);

      const grant = await adminContext.client.post(
        `${ADMINS}/${victimUser.id}/permissions`,
        {
          headers: csrf(adminContext),
          body: { permissions: [Permission.USER_READ] }
        }
      );
      const revoke = await adminContext.client.delete(
        `${ADMINS}/${victimUser.id}/permissions`,
        {
          headers: csrf(adminContext),
          body: { permissions: [Permission.USER_READ] }
        }
      );

      expect(grant.status).toBe(403);
      expect(revoke.status).toBe(403);

      const mine = await victim.client.get('/v1/admin/permissions/me');
      expect(mine.body.permissions).toEqual([]);
    });

    it('should let the owner manage every administrator', async () => {
      const ownerContext = await owner();
      const target = await admin([], otherUser('9'));
      const targetUser = await findByEmail(target.user.email);

      const grant = await ownerContext.client.post(
        `${ADMINS}/${targetUser.id}/permissions`,
        {
          headers: csrf(ownerContext),
          body: { permissions: [Permission.USER_READ] }
        }
      );
      const rename = await ownerContext.client.patch(
        `${ADMINS}/${targetUser.id}`,
        { headers: csrf(ownerContext), body: { name: 'Managed' } }
      );
      const deactivate = await ownerContext.client.post(
        `${ADMINS}/${targetUser.id}/deactivate`,
        { headers: csrf(ownerContext) }
      );
      const activate = await ownerContext.client.post(
        `${ADMINS}/${targetUser.id}/activate`,
        { headers: csrf(ownerContext) }
      );
      const remove = await ownerContext.client.delete(
        `${ADMINS}/${targetUser.id}`,
        { headers: csrf(ownerContext) }
      );

      expect([
        grant.status,
        rename.status,
        deactivate.status,
        activate.status,
        remove.status
      ]).toEqual([204, 204, 204, 204, 204]);
    });
  });

  describe('administrator visibility', () => {
    it('should refuse an administrator the directory', async () => {
      const adminContext = await admin(DELEGABLE_PERMISSIONS as Permission[]);

      const res = await adminContext.client.get(ADMINS);

      expect(res.status).toBe(403);
    });

    it('should refuse an administrator resolving a peer by identifier', async () => {
      const adminContext = await admin(DELEGABLE_PERMISSIONS as Permission[]);
      const peer = await admin([], otherUser('10'));
      const peerUser = await findByEmail(peer.user.email);

      const res = await adminContext.client.get(`${ADMINS}/${peerUser.id}`);

      expect(res.status).toBe(403);
    });

    /** What an administrator gets instead of the directory: themselves. */
    it('should let an administrator read their own profile', async () => {
      const adminContext = await admin([Permission.USER_READ]);
      const self = await findByEmail(adminContext.user.email);

      const res = await adminContext.client.get(`${ADMINS}/me`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(self.id);
      expect(res.body.permissions).toEqual([Permission.USER_READ]);
    });

    it('should refuse an ordinary user the self profile', async () => {
      const context = await plainUser();

      expect((await context.client.get(`${ADMINS}/me`)).status).toBe(403);
    });

    it('should let the owner see every administrator', async () => {
      const ownerContext = await owner();
      await admin([], otherUser('11'));
      await admin([], otherUser('12'));

      const res = await ownerContext.client.get(ADMINS);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
    });
  });

  describe('owner invisibility', () => {
    it('should exclude the owner from the user listing', async () => {
      const ownerContext = await owner();
      const adminContext = await admin([Permission.USER_READ], otherUser('13'));
      await plainUser(otherUser('14'));

      const res = await adminContext.client.get('/v1/admin/users');

      expect(res.status).toBe(200);
      const emails = res.body.items.map((u: { email: string }) => u.email);
      expect(emails).not.toContain(ownerContext.user.email);
      expect(emails).toContain('other14@test.com');
    });

    /** No administrator appears in user management either. */
    it('should exclude administrators from the user listing', async () => {
      const adminContext = await admin([Permission.USER_READ], otherUser('15'));
      await plainUser(otherUser('16'));

      const res = await adminContext.client.get('/v1/admin/users');

      const roles = res.body.items.map((u: { role: string }) => u.role);
      expect(roles.every((role: string) => role === UserRole.USER)).toBe(true);
    });

    it('should exclude the owner from the administrator listing', async () => {
      const ownerContext = await owner();
      await admin([], otherUser('17'));

      const res = await ownerContext.client.get(ADMINS);

      const emails = res.body.items.map((u: { email: string }) => u.email);
      expect(emails).not.toContain(ownerContext.user.email);
    });

    /**
     * An identifier harvested elsewhere must not be resolvable into a
     * confirmation that it belongs to the owner.
     */
    it('should answer NOT_FOUND when an administrator resolves the owner by identifier', async () => {
      const ownerContext = await owner();
      const adminContext = await admin([Permission.USER_READ], otherUser('18'));
      const ownerUser = await findByEmail(ownerContext.user.email);

      const res = await adminContext.client.get(
        `/v1/admin/users/${ownerUser.id}`
      );

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain(ownerContext.user.email);
    });

    it('should answer identically for the owner and for an identifier that was never issued', async () => {
      const ownerContext = await owner();
      const adminContext = await admin([Permission.USER_READ], otherUser('19'));
      const ownerUser = await findByEmail(ownerContext.user.email);

      const forOwner = await adminContext.client.get(
        `/v1/admin/users/${ownerUser.id}`
      );
      const forAbsent = await adminContext.client.get(
        '/v1/admin/users/11111111-1111-4111-8111-111111111111'
      );

      expect(forOwner.status).toBe(forAbsent.status);
      expect(forOwner.body.error.code).toBe(forAbsent.body.error.code);
    });

    it('should refuse to suspend the owner through the user route', async () => {
      const ownerContext = await owner();
      const adminContext = await admin(
        [Permission.USER_SUSPEND],
        otherUser('20')
      );
      const ownerUser = await findByEmail(ownerContext.user.email);

      const res = await adminContext.client.post(
        `/v1/admin/users/${ownerUser.id}/suspend`,
        {
          headers: csrf(adminContext),
          body: { reason: 'attempting to suspend the owner' }
        }
      );

      expect(res.status).toBe(404);
      expect((await findByEmail(ownerContext.user.email)).status).toBe(
        UserStatus.ACTIVATE
      );
    });

    it('should refuse to suspend an administrator through the user route', async () => {
      const adminContext = await admin(
        [Permission.USER_SUSPEND],
        otherUser('21')
      );
      const victim = await admin([], otherUser('22'));
      const victimUser = await findByEmail(victim.user.email);

      const res = await adminContext.client.post(
        `/v1/admin/users/${victimUser.id}/suspend`,
        { headers: csrf(adminContext), body: { reason: 'cross-population' } }
      );

      expect(res.status).toBe(404);
      expect((await findByEmail(victim.user.email)).status).toBe(
        UserStatus.ACTIVATE
      );
    });

    it('should keep the owner out of a paginated sweep of the user listing', async () => {
      const ownerContext = await owner();
      const adminContext = await admin([Permission.USER_READ], otherUser('23'));
      for (const suffix of ['24', '25', '26']) {
        await plainUser(otherUser(suffix));
      }

      const seen: string[] = [];
      let cursor: string | null = null;

      do {
        const res = await adminContext.client.get(
          `/v1/admin/users?limit=1${cursor ? `&cursor=${cursor}` : ''}`
        );
        expect(res.status).toBe(200);
        seen.push(...res.body.items.map((u: { email: string }) => u.email));
        cursor = res.body.nextCursor;
      } while (cursor);

      expect(seen).not.toContain(ownerContext.user.email);
      expect(seen).not.toContain(adminContext.user.email);
      expect(seen).toHaveLength(3);
    });
  });
});
