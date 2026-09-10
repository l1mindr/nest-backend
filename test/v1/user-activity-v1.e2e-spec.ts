import {
  IUserActivityRepository,
  USER_ACTIVITY_REPOSITORY
} from '@features/activity/application/interfaces/activity.interface';
import { ACTIVITY_RETENTION_DAYS } from '@features/activity/domain/activity-catalog';
import { ActivityAction } from '@features/activity/domain/enums/activity-action.enum';
import { ActivityCategory } from '@features/activity/domain/enums/activity-category.enum';
import { Coin } from '@features/coin-tracker/domain/entities/coin.entity';
import { User } from '@features/users/domain/entities/user.entity';
import { AlertDirection } from '@features/coin-tracker/domain/enums/alert-direction.enum';
import { AlertTriggerMode } from '@features/coin-tracker/domain/enums/alert-trigger-mode.enum';
import { NotificationChannel } from '@features/coin-tracker/domain/enums/notification-channel.enum';
import { TimeConstants } from '@infrastructure/clock/time.constants';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { AuthFactory } from '../factories/auth.factory';
import { ApiClient } from '../helpers/api-client.helper';
import { getMongoConnection } from '../helpers/mongodb.helper';
import { truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';
import { AuthenticatedUserContext } from '../utils/types/factory.types';

const ACTIVITY_URL = '/v1/user/activity';
const COLLECTION = 'user_activities';

describe('User Activity (e2e) version: 1', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let mongo: any;

  beforeAll(async () => {
    const context = await createMigratedTestApp();
    app = context.app;
    dataSource = context.dataSource;
    mongo = await getMongoConnection(app);
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
    await mongo.db.collection(COLLECTION).deleteMany({});
    await seedCoins();
  });

  afterAll(async () => {
    await app?.close();
  });

  /**
   * The registered account's id. `TestUser` carries only the credentials the
   * factory registered with, so the id is read back from Postgres.
   */
  async function userIdOf(context: AuthenticatedUserContext): Promise<string> {
    const user = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email: context.user.email });

    return user.id;
  }

  /**
   * `createUserDto` defaults to one fixed address, so two accounts in the same
   * test have to be told apart explicitly — otherwise both registrations
   * resolve to the same row and an isolation test proves nothing.
   */
  function authenticateAs(name: string): Promise<AuthenticatedUserContext> {
    return AuthFactory.authenticated(app, {
      overrides: { email: `${name}@test.com`, username: name }
    });
  }

  function mutationHeaders(context: AuthenticatedUserContext) {
    return { 'X-CSRF-Token': context.response.headers.xCsrfToken };
  }

  async function seedCoins(): Promise<void> {
    await dataSource.getRepository(Coin).save([
      {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        image: null,
        isActive: true,
        lastSyncedAt: new Date('2026-07-28T08:00:00.000Z')
      }
    ]);
  }

  /**
   * Activities are written fire-and-forget, so the response can land before the
   * row does. Polls rather than sleeping a fixed interval, which would either
   * be flaky or slow.
   */
  async function waitForActivities(
    userId: string,
    atLeast = 1,
    timeoutMs = 5000
  ): Promise<any[]> {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const docs = await mongo.db
        .collection(COLLECTION)
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();

      if (docs.length >= atLeast || Date.now() > deadline) return docs;

      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * Clears what signing in recorded, so a test starts from a known slate.
   *
   * Waits for those writes first: they are fire-and-forget, so deleting
   * immediately after login can race a row that has not landed yet and leave
   * it behind to pollute the test that follows.
   */
  async function clearActivities(
    ...contexts: AuthenticatedUserContext[]
  ): Promise<void> {
    for (const context of contexts) {
      await waitForActivities(await userIdOf(context), 2, 2000);
    }

    await mongo.db.collection(COLLECTION).deleteMany({});
  }

  async function insertActivity(
    userId: string,
    overrides: Record<string, unknown> = {}
  ): Promise<void> {
    const now = new Date();

    await mongo.db.collection(COLLECTION).insertOne({
      userId,
      category: ActivityCategory.TRANSACTION,
      action: ActivityAction.CREATED,
      entityType: 'TRANSACTION',
      entityId: 'tx-1',
      metadata: null,
      createdAt: now,
      expiresAt: new Date(
        now.getTime() + ACTIVITY_RETENTION_DAYS * TimeConstants.MS_PER_DAY
      ),
      ...overrides
    });
  }

  describe('recording after a successful operation', () => {
    it('records a sign-in', async () => {
      const context = await AuthFactory.authenticated(app);

      const docs = await waitForActivities(await userIdOf(context));

      expect(
        docs.some(
          (d) =>
            d.category === ActivityCategory.SECURITY &&
            d.action === ActivityAction.LOGIN
        )
      ).toBe(true);
    });

    it('records the session that sign-in created', async () => {
      const context = await AuthFactory.authenticated(app);

      const docs = await waitForActivities(await userIdOf(context), 2);

      expect(
        docs.some((d) => d.action === ActivityAction.SESSION_CREATED)
      ).toBe(true);
    });

    it('records a created price alert, with display metadata', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);

      const created = await context.client.post('/v1/price-alerts', {
        headers: mutationHeaders(context),
        body: {
          coinId: 'bitcoin',
          targetPrice: 120000,
          direction: AlertDirection.SELL,
          triggerMode: AlertTriggerMode.ONCE,
          notificationChannels: [NotificationChannel.EMAIL]
        }
      });

      expect(created.status).toBe(201);

      const [activity] = await waitForActivities(await userIdOf(context));

      expect(activity).toMatchObject({
        category: ActivityCategory.PRICE_ALERT,
        action: ActivityAction.CREATED,
        entityType: 'PRICE_ALERT',
        metadata: { assetSymbol: 'btc', direction: AlertDirection.SELL }
      });
    });

    it('records a password change', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);

      const changed = await context.client.post('/v1/auth/change-password', {
        headers: mutationHeaders(context),
        body: {
          currentPassword: context.user.password,
          newPassword: 'NewPassw0rd!'
        }
      });

      expect(changed.status).toBe(204);

      const docs = await waitForActivities(await userIdOf(context));

      expect(
        docs.some((d) => d.action === ActivityAction.PASSWORD_CHANGED)
      ).toBe(true);
    });
  });

  describe('a failed operation records nothing', () => {
    it('does not record an alert that was rejected', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);

      const rejected = await context.client.post('/v1/price-alerts', {
        headers: mutationHeaders(context),
        body: {
          coinId: 'no-such-coin',
          targetPrice: 1,
          direction: AlertDirection.BUY,
          triggerMode: AlertTriggerMode.ONCE,
          notificationChannels: [NotificationChannel.EMAIL]
        }
      });

      expect(rejected.status).toBe(404);

      // Give any stray write the same window a real one would have had.
      await new Promise((resolve) => setTimeout(resolve, 300));

      const docs = await waitForActivities(await userIdOf(context), 0, 0);

      expect(docs).toHaveLength(0);
    });

    it('does not record a sign-in that was refused', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);

      const refused = await context.client.post('/v1/auth/login', {
        body: { email: context.user.email, password: 'WrongPassw0rd!' }
      });

      expect(refused.status).toBeGreaterThanOrEqual(400);

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(
        await waitForActivities(await userIdOf(context), 0, 0)
      ).toHaveLength(0);
    });
  });

  /**
   * The central promise of the design: activity is telemetry, so losing it must
   * never turn a committed operation into an error.
   */
  describe('a MongoDB failure does not break the operation', () => {
    it('still creates the price alert, and still returns 201', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);

      const repository = app.get<IUserActivityRepository>(
        USER_ACTIVITY_REPOSITORY
      );
      const spy = jest
        .spyOn(repository, 'create')
        .mockRejectedValue(new Error('Mongo is down'));

      try {
        const created = await context.client.post('/v1/price-alerts', {
          headers: mutationHeaders(context),
          body: {
            coinId: 'bitcoin',
            targetPrice: 99000,
            direction: AlertDirection.BUY,
            triggerMode: AlertTriggerMode.ONCE,
            notificationChannels: [NotificationChannel.EMAIL]
          }
        });

        expect(created.status).toBe(201);
        expect(created.body.id).toBeDefined();

        // The alert is really there — the failure was confined to telemetry.
        const list = await context.client.get('/v1/price-alerts');
        expect(list.body.items).toHaveLength(1);

        expect(spy).toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('reading your own activity', () => {
    it('returns the caller’s activities, newest first', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);

      const older = new Date('2026-09-01T10:00:00.000Z');
      const newer = new Date('2026-09-02T10:00:00.000Z');
      await insertActivity(await userIdOf(context), { createdAt: older });
      await insertActivity(await userIdOf(context), { createdAt: newer });

      const response = await context.client.get(ACTIVITY_URL);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(2);
      expect(
        new Date(response.body.items[0].createdAt).getTime()
      ).toBeGreaterThan(new Date(response.body.items[1].createdAt).getTime());
    });

    it('returns an empty page when there is nothing', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);

      const response = await context.client.get(ACTIVITY_URL);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ items: [], nextCursor: null });
    });

    it('exposes the display fields and hides the internal ones', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);
      await insertActivity(await userIdOf(context), {
        metadata: { assetSymbol: 'BTC', transactionType: 'BUY' }
      });

      const { body } = await context.client.get(ACTIVITY_URL);

      expect(body.items[0]).toMatchObject({
        category: ActivityCategory.TRANSACTION,
        action: ActivityAction.CREATED,
        entityType: 'TRANSACTION',
        entityId: 'tx-1',
        metadata: { assetSymbol: 'BTC', transactionType: 'BUY' }
      });
      expect(body.items[0]).not.toHaveProperty('userId');
      expect(body.items[0]).not.toHaveProperty('expiresAt');
    });

    // A fresh client rather than the authenticated one with its cookies
    // stripped: the helper wraps a supertest agent, which keeps its own cookie
    // jar and would re-attach the session regardless of the header.
    it('requires authentication', async () => {
      const anonymous = await new ApiClient(app).get(ACTIVITY_URL);

      expect([401, 403]).toContain(anonymous.status);
    });
  });

  describe('category filtering', () => {
    it('returns only the requested category', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);

      await insertActivity(await userIdOf(context), {
        category: ActivityCategory.TRANSACTION
      });
      await insertActivity(await userIdOf(context), {
        category: ActivityCategory.SECURITY,
        action: ActivityAction.LOGIN
      });

      const { body } = await context.client.get(
        `${ACTIVITY_URL}?category=${ActivityCategory.SECURITY}`
      );

      expect(body.items).toHaveLength(1);
      expect(body.items[0].category).toBe(ActivityCategory.SECURITY);
    });

    it('returns everything when no category is given', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);

      await insertActivity(await userIdOf(context), {
        category: ActivityCategory.TRANSACTION
      });
      await insertActivity(await userIdOf(context), {
        category: ActivityCategory.SECURITY,
        action: ActivityAction.LOGIN
      });

      const { body } = await context.client.get(ACTIVITY_URL);

      expect(body.items).toHaveLength(2);
    });

    it('rejects a category outside the enum', async () => {
      const context = await AuthFactory.authenticated(app);

      const response = await context.client.get(
        `${ACTIVITY_URL}?category=NOT_A_CATEGORY`
      );

      expect(response.status).toBe(422);
    });
  });

  describe('cursor pagination', () => {
    async function seedActivities(userId: string, count: number) {
      for (let i = 0; i < count; i++) {
        await insertActivity(userId, {
          entityId: `tx-${i}`,
          createdAt: new Date(Date.parse('2026-09-01T10:00:00.000Z') + i * 1000)
        });
      }
    }

    it('walks the whole list without repeating or dropping a row', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);
      await seedActivities(await userIdOf(context), 5);

      const seen: string[] = [];
      let cursor: string | null = null;

      do {
        const url: string = cursor
          ? `${ACTIVITY_URL}?limit=2&cursor=${encodeURIComponent(cursor)}`
          : `${ACTIVITY_URL}?limit=2`;

        const { body } = await context.client.get(url);
        seen.push(...body.items.map((item: { id: string }) => item.id));
        cursor = body.nextCursor;
      } while (cursor);

      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
    });

    it('reports a null cursor on the last page', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);
      await seedActivities(await userIdOf(context), 2);

      const { body } = await context.client.get(`${ACTIVITY_URL}?limit=10`);

      expect(body.items).toHaveLength(2);
      expect(body.nextCursor).toBeNull();
    });

    it('honours the page size', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);
      await seedActivities(await userIdOf(context), 5);

      const { body } = await context.client.get(`${ACTIVITY_URL}?limit=3`);

      expect(body.items).toHaveLength(3);
      expect(body.nextCursor).not.toBeNull();
    });

    it('rejects a cursor it did not issue', async () => {
      const context = await AuthFactory.authenticated(app);

      const response = await context.client.get(
        `${ACTIVITY_URL}?cursor=bm90LWEtY3Vyc29y`
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('ACTIVITY_INVALID_CURSOR');
    });

    it('rejects a page size above the maximum', async () => {
      const context = await AuthFactory.authenticated(app);

      const response = await context.client.get(`${ACTIVITY_URL}?limit=101`);

      expect(response.status).toBe(422);
    });
  });

  describe('user isolation', () => {
    it('never returns another account’s activities', async () => {
      const alice = await authenticateAs('alice');
      const bob = await authenticateAs('bob');
      await clearActivities(alice, bob);

      await insertActivity(await userIdOf(bob), { entityId: 'bob-tx' });

      const { body } = await alice.client.get(ACTIVITY_URL);

      expect(body.items).toHaveLength(0);
    });

    it('shows each account only its own rows', async () => {
      const alice = await authenticateAs('alice');
      const bob = await authenticateAs('bob');
      await clearActivities(alice, bob);

      await insertActivity(await userIdOf(alice), { entityId: 'alice-tx' });
      await insertActivity(await userIdOf(bob), { entityId: 'bob-tx' });

      const aliceBody = (await alice.client.get(ACTIVITY_URL)).body;
      const bobBody = (await bob.client.get(ACTIVITY_URL)).body;

      expect(aliceBody.items).toHaveLength(1);
      expect(aliceBody.items[0].entityId).toBe('alice-tx');
      expect(bobBody.items).toHaveLength(1);
      expect(bobBody.items[0].entityId).toBe('bob-tx');
    });

    /**
     * The endpoint takes its account from the session. A `userId` on the query
     * string is an unknown property, so it changes nothing — this asserts that
     * directly rather than trusting the DTO to stay free of the field.
     */
    it('ignores a userId supplied on the query string', async () => {
      const alice = await authenticateAs('alice');
      const bob = await authenticateAs('bob');
      await clearActivities(alice, bob);

      await insertActivity(await userIdOf(bob), { entityId: 'bob-tx' });

      const response = await alice.client.get(
        `${ACTIVITY_URL}?userId=${await userIdOf(bob)}`
      );

      expect([200, 422]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.items).toHaveLength(0);
      }
    });
  });

  describe('30 day retention', () => {
    it('stamps expiresAt exactly 30 days after createdAt', async () => {
      const context = await AuthFactory.authenticated(app);

      const [activity] = await waitForActivities(await userIdOf(context));

      expect(activity.expiresAt.getTime() - activity.createdAt.getTime()).toBe(
        ACTIVITY_RETENTION_DAYS * TimeConstants.MS_PER_DAY
      );
    });

    /**
     * Deletion is MongoDB's, so what is verified is the index that makes it
     * happen — waiting 30 days is not a test.
     */
    it('carries a TTL index that expires on the value of expiresAt', async () => {
      const indexes = await mongo.db.collection(COLLECTION).indexes();

      const ttl = indexes.find(
        (index: any) => index.key && index.key.expiresAt === 1
      );

      expect(ttl).toBeDefined();
      expect(ttl.expireAfterSeconds).toBe(0);
    });

    it('carries the index the read path needs', async () => {
      const indexes = await mongo.db.collection(COLLECTION).indexes();

      const query = indexes.find(
        (index: any) =>
          index.key && index.key.userId === 1 && index.key.createdAt === -1
      );

      expect(query).toBeDefined();
    });
  });

  describe('metadata safety', () => {
    it('never persists a secret handed to the recorder', async () => {
      const context = await AuthFactory.authenticated(app);
      await clearActivities(context);

      const repository = app.get<IUserActivityRepository>(
        USER_ACTIVITY_REPOSITORY
      );

      await repository.create({
        userId: await userIdOf(context),
        category: ActivityCategory.ACCOUNT,
        action: ActivityAction.PROFILE_UPDATED,
        metadata: { password: 'hunter2', displayName: 'Ali' }
      });

      const [activity] = await waitForActivities(await userIdOf(context));

      expect(activity.metadata).toEqual({
        password: '[REDACTED]',
        displayName: 'Ali'
      });
    });
  });
});
