import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { UserFactory } from '../factories/user.factory';
import { AuthenticatedUserContext } from '../utils/types/factory.types';
import { ApiClient } from '../helpers/api-client.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

/**
 * `GET /v1/admin/users/statistics` — the account population, owner included.
 *
 * The regression under test: the "total users" figure used to be counted from
 * `GET /v1/admin/users`, which pages the `USER` population only. A system
 * holding an owner and two users therefore reported two. The owner is an
 * account and belongs in the total; the listing's scoping is a rule about who
 * is administrable, not about who exists.
 *
 * Both halves are asserted together in `population separation`, so a future
 * change cannot fix the total by widening the listing.
 */
describe('Admin User Statistics (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  /** Signs in the single owner. Every spec here needs one. */
  const owner = (): Promise<AuthenticatedUserContext> =>
    AuthFactory.authenticated(
      app,
      {
        withRole: UserRole.OWNER,
        overrides: {
          email: 'owner@test.com',
          username: 'owneraccount',
          password: 'Password@123'
        }
      },
      dataSource
    );

  /** Registers and verifies an ordinary account. */
  const regularUser = async (n: number): Promise<void> => {
    const context = await UserFactory.register(app, {
      email: `user${n}@test.com`,
      username: `user${n}`,
      password: 'Password@123'
    });

    await UserFactory.verifyEmail(app, context.user.email);
  };

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

  describe('total', () => {
    it('counts the owner alone as one account', async () => {
      const ownerContext = await owner();

      const res = await ownerContext.client.get('/v1/admin/users/statistics');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.byRole).toEqual({
        [UserRole.OWNER]: 1,
        [UserRole.ADMIN]: 0,
        [UserRole.USER]: 0
      });
    });

    it('counts the owner and one user as two accounts', async () => {
      const ownerContext = await owner();
      await regularUser(1);

      const res = await ownerContext.client.get('/v1/admin/users/statistics');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
    });

    /**
     * The reported case: owner + user A + user B is three, not two.
     */
    it('counts the owner and two users as three accounts', async () => {
      const ownerContext = await owner();
      await regularUser(1);
      await regularUser(2);

      const res = await ownerContext.client.get('/v1/admin/users/statistics');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.byRole).toEqual({
        [UserRole.OWNER]: 1,
        [UserRole.ADMIN]: 0,
        [UserRole.USER]: 2
      });
    });

    it('counts owner, administrator and regular users together', async () => {
      const ownerContext = await owner();

      await UserFactory.admin(app, dataSource, {
        email: 'admin@test.com',
        username: 'adminaccount',
        password: 'Password@123'
      });

      await regularUser(1);
      await regularUser(2);

      const res = await ownerContext.client.get('/v1/admin/users/statistics');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(4);
      expect(res.body.byRole).toEqual({
        [UserRole.OWNER]: 1,
        [UserRole.ADMIN]: 1,
        [UserRole.USER]: 2
      });
    });
  });

  describe('population separation', () => {
    /**
     * The total is fixed by counting over every role — not by letting the owner
     * leak into user management. Both must hold at once.
     */
    it('includes the owner in the total while keeping them out of the listing', async () => {
      const ownerContext = await owner();
      await regularUser(1);
      await regularUser(2);

      const stats = await ownerContext.client.get('/v1/admin/users/statistics');
      const list = await ownerContext.client.get('/v1/admin/users');

      expect(stats.status).toBe(200);
      expect(stats.body.total).toBe(3);

      expect(list.status).toBe(200);
      expect(list.body.items).toHaveLength(2);
      expect(
        list.body.items.every(
          (item: { role: string }) => item.role === UserRole.USER
        )
      ).toBe(true);
      expect(
        list.body.items.some(
          (item: { email: string }) => item.email === 'owner@test.com'
        )
      ).toBe(false);
    });

    /**
     * A total counted from the listing is also a total capped by the page size.
     * Asking for a single-item page must not move the aggregate.
     */
    it('reports the same total regardless of how the listing is paged', async () => {
      const ownerContext = await owner();
      await regularUser(1);
      await regularUser(2);

      const firstPage = await ownerContext.client.get(
        '/v1/admin/users?limit=1'
      );
      const stats = await ownerContext.client.get('/v1/admin/users/statistics');

      expect(firstPage.body.items).toHaveLength(1);
      expect(stats.body.total).toBe(3);
    });
  });

  describe('statuses', () => {
    it('counts statuses over the same population as the total', async () => {
      const ownerContext = await owner();

      // Registered but never verified, so it stays PENDING_VERIFICATION.
      await UserFactory.register(app, {
        email: 'pending@test.com',
        username: 'pendinguser',
        password: 'Password@123'
      });

      await regularUser(1);

      const res = await ownerContext.client.get('/v1/admin/users/statistics');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.byStatus).toEqual({
        // The owner and the verified account.
        [UserStatus.ACTIVATE]: 2,
        [UserStatus.DEACTIVATE]: 0,
        [UserStatus.SUSPEND]: 0,
        [UserStatus.PENDING_VERIFICATION]: 1
      });
      expect(
        Object.values(res.body.byStatus as Record<string, number>).reduce(
          (sum, value) => sum + value,
          0
        )
      ).toBe(res.body.total);
    });
  });

  describe('authorization', () => {
    it('admits an administrator holding USER_READ', async () => {
      const adminContext = await AuthFactory.authenticated(
        app,
        {
          withRole: UserRole.ADMIN,
          overrides: {
            email: 'admin@test.com',
            username: 'adminaccount',
            password: 'Password@123'
          }
        },
        dataSource
      );

      const res = await adminContext.client.get('/v1/admin/users/statistics');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it('refuses an ordinary account', async () => {
      const userContext = await AuthFactory.authenticated(app, {
        overrides: {
          email: 'plain@test.com',
          username: 'plainuser',
          password: 'Password@123'
        }
      });

      const res = await userContext.client.get('/v1/admin/users/statistics');

      expect(res.status).toBe(403);
    });

    it('refuses an anonymous caller', async () => {
      await owner();

      // A fresh client, so the agent carries no cookie jar of its own.
      const res = await new ApiClient(app).get('/v1/admin/users/statistics');

      expect(res.status).toBe(401);
    });
  });

  /**
   * `statistics` is a literal segment on a controller that also declares
   * `:id`. If the parameterised route were registered first it would match
   * here and answer on a malformed identifier instead.
   */
  it('is not shadowed by the :id route', async () => {
    const ownerContext = await owner();

    const res = await ownerContext.client.get('/v1/admin/users/statistics');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).not.toHaveProperty('id');
  });
});
