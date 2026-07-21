import { ClockService } from '@core/clock/clock.service';
import { Session } from '@features/sessions/entities/session.entity';
import {
  ISessionsService,
  SESSION_SERVICE
} from '@features/sessions/interfaces/sessions.interface';
import { User } from '@features/users/entities/user.entity';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, MoreThan, QueryRunner } from 'typeorm';
import { createTestApp } from '../bootstrap/test-app';
import { UserFactory } from '../factories/user.factory';
import { runMigrations, truncateDatabase } from '../helpers/postgresql.helper';
import { clearRedis } from '../helpers/redis.helper';

describe('Session limit concurrency (e2e)', () => {
  let app: INestApplication;
  let clockService: ClockService;
  let configService: ConfigService;
  let dataSource: DataSource;
  let sessionsService: ISessionsService;

  beforeAll(async () => {
    const { app: testApp, dataSource: testDataSource } = await createTestApp();
    await runMigrations(testDataSource);

    app = testApp;
    clockService = app.get(ClockService);
    configService = app.get(ConfigService);
    dataSource = testDataSource;
    sessionsService = app.get<ISessionsService>(SESSION_SERVICE);
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);
    await clearRedis(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('should never expose more active sessions than the configured limit', async () => {
    const previousLimit = configService.getOrThrow<number>(
      'MAX_ACTIVE_SESSIONS'
    );
    const limit = 2;
    const concurrentIssues = 6;
    const context = await UserFactory.register(app);
    await UserFactory.verifyEmail(app, context.user.email);

    const user = await dataSource.getRepository(User).findOneByOrFail({
      email: context.user.email
    });
    const blocker = dataSource.createQueryRunner();
    const issuePromises: Promise<Session>[] = [];

    configService.set('MAX_ACTIVE_SESSIONS', limit);

    try {
      await blocker.connect();
      await blocker.startTransaction();
      await lockUser(blocker, user.id);

      const expiresAt = clockService.snapshot().expiresAt;
      for (let index = 0; index < concurrentIssues; index += 1) {
        issuePromises.push(
          sessionsService.issue(
            user.id,
            `127.0.0.${index + 1}`,
            {
              browserName: 'Chrome',
              browserVersion: '148.0.0',
              osName: 'Linux',
              deviceType: 'desktop'
            },
            expiresAt
          )
        );
      }

      await waitForLockWaiters(dataSource, concurrentIssues);
      expect(await countActiveSessions(dataSource, clockService, user.id)).toBe(
        0
      );

      let observing = true;
      let maxObserved = 0;
      const observation = (async () => {
        while (observing) {
          maxObserved = Math.max(
            maxObserved,
            await countActiveSessions(dataSource, clockService, user.id)
          );
          await delay(1);
        }

        maxObserved = Math.max(
          maxObserved,
          await countActiveSessions(dataSource, clockService, user.id)
        );
      })();

      await blocker.commitTransaction();

      try {
        await Promise.all(issuePromises);
      } finally {
        observing = false;
        await observation;
      }

      const sessions = await dataSource.getRepository(Session).find({
        where: { owner: { id: user.id } }
      });

      expect(maxObserved).toBeLessThanOrEqual(limit);
      expect(sessions).toHaveLength(concurrentIssues);
      expect(sessions.filter((session) => !session.isRevoked)).toHaveLength(
        limit
      );
      expect(sessions.filter((session) => session.isRevoked)).toHaveLength(
        concurrentIssues - limit
      );
    } finally {
      if (blocker.isTransactionActive) {
        await blocker.rollbackTransaction();
      }
      if (!blocker.isReleased) {
        await blocker.release();
      }
      await Promise.allSettled(issuePromises);

      restoreSessionLimit(configService, previousLimit);
    }
  });

  it('should not block session issuance for a different user', async () => {
    const previousLimit = configService.getOrThrow<number>(
      'MAX_ACTIVE_SESSIONS'
    );
    const firstContext = await UserFactory.register(app);
    const secondContext = await UserFactory.register(app, {
      email: 'second@test.com',
      username: 'seconduser'
    });
    await Promise.all([
      UserFactory.verifyEmail(app, firstContext.user.email),
      UserFactory.verifyEmail(app, secondContext.user.email)
    ]);

    const userRepository = dataSource.getRepository(User);
    const [firstUser, secondUser] = await Promise.all([
      userRepository.findOneByOrFail({ email: firstContext.user.email }),
      userRepository.findOneByOrFail({ email: secondContext.user.email })
    ]);
    const blocker = dataSource.createQueryRunner();
    const pendingIssues: Promise<Session>[] = [];

    configService.set('MAX_ACTIVE_SESSIONS', 1);

    try {
      await blocker.connect();
      await blocker.startTransaction();
      await lockUser(blocker, firstUser.id);

      const expiresAt = clockService.snapshot().expiresAt;
      pendingIssues.push(
        sessionsService.issue(
          firstUser.id,
          '127.0.0.1',
          {
            browserName: 'Chrome',
            browserVersion: '148.0.0',
            osName: 'Linux',
            deviceType: 'desktop'
          },
          expiresAt
        )
      );

      await waitForLockWaiters(dataSource, 1);

      const secondIssue = sessionsService.issue(
        secondUser.id,
        '127.0.0.2',
        {
          browserName: 'Firefox',
          browserVersion: '142.0.0',
          osName: 'Linux',
          deviceType: 'desktop'
        },
        expiresAt
      );
      pendingIssues.push(secondIssue);

      await expect(withTimeout(secondIssue, 1_000)).resolves.toEqual(
        expect.objectContaining({ owner: expect.anything() })
      );
      expect(
        await countActiveSessions(dataSource, clockService, secondUser.id)
      ).toBe(1);

      await blocker.commitTransaction();
      await pendingIssues[0];
    } finally {
      if (blocker.isTransactionActive) {
        await blocker.rollbackTransaction();
      }
      if (!blocker.isReleased) {
        await blocker.release();
      }
      await Promise.allSettled(pendingIssues);

      restoreSessionLimit(configService, previousLimit);
    }
  });

  it('should revoke the least recently used session and keep recent activity valid', async () => {
    const previousLimit = configService.getOrThrow<number>(
      'MAX_ACTIVE_SESSIONS'
    );
    const context = await UserFactory.register(app);
    await UserFactory.verifyEmail(app, context.user.email);

    const user = await dataSource.getRepository(User).findOneByOrFail({
      email: context.user.email
    });
    const repository = dataSource.getRepository(Session);
    const { now, expiresAt } = clockService.snapshot();

    try {
      configService.set('MAX_ACTIVE_SESSIONS', 3);
      const phone = await sessionsService.issue(
        user.id,
        '127.0.0.1',
        {
          browserName: 'Chrome',
          browserVersion: '148.0.0',
          osName: 'Android',
          deviceType: 'mobile'
        },
        expiresAt
      );
      const laptop = await sessionsService.issue(
        user.id,
        '127.0.0.2',
        {
          browserName: 'Firefox',
          browserVersion: '142.0.0',
          osName: 'Linux',
          deviceType: 'desktop'
        },
        expiresAt
      );

      await Promise.all([
        repository.update(
          { id: phone.id },
          {
            createdAt: clockService.addDaysFrom(now, -180),
            lastUsedAt: clockService.dateFromMs(now - 30_000)
          }
        ),
        repository.update(
          { id: laptop.id },
          {
            createdAt: clockService.addDaysFrom(now, -1),
            lastUsedAt: clockService.addDaysFrom(now, -14)
          }
        )
      ]);

      configService.set('MAX_ACTIVE_SESSIONS', 2);
      const newest = await sessionsService.issue(
        user.id,
        '127.0.0.3',
        {
          browserName: 'Safari',
          browserVersion: '18.0',
          osName: 'MacOS',
          deviceType: 'desktop'
        },
        expiresAt
      );

      const [storedPhone, storedLaptop, storedNewest] = await Promise.all([
        repository.findOneByOrFail({ id: phone.id }),
        repository.findOneByOrFail({ id: laptop.id }),
        repository.findOneByOrFail({ id: newest.id })
      ]);

      expect(storedPhone.isRevoked).toBe(false);
      expect(storedLaptop.isRevoked).toBe(true);
      expect(storedNewest.isRevoked).toBe(false);
      await expect(
        sessionsService.getActive(user.id, phone.id)
      ).resolves.toEqual(expect.objectContaining({ id: phone.id }));
      await expect(
        sessionsService.getActive(user.id, laptop.id)
      ).resolves.toBeNull();
    } finally {
      restoreSessionLimit(configService, previousLimit);
    }
  });

  it('should use creation time as a deterministic tie-break for equal activity', async () => {
    const previousLimit = configService.getOrThrow<number>(
      'MAX_ACTIVE_SESSIONS'
    );
    const context = await UserFactory.register(app);
    await UserFactory.verifyEmail(app, context.user.email);

    const user = await dataSource.getRepository(User).findOneByOrFail({
      email: context.user.email
    });
    const repository = dataSource.getRepository(Session);
    const { now, expiresAt } = clockService.snapshot();

    try {
      configService.set('MAX_ACTIVE_SESSIONS', 3);
      const older = await sessionsService.issue(
        user.id,
        '127.0.0.1',
        {
          browserName: 'Chrome',
          browserVersion: '148.0.0',
          osName: 'Linux',
          deviceType: 'desktop'
        },
        expiresAt
      );
      const newer = await sessionsService.issue(
        user.id,
        '127.0.0.2',
        {
          browserName: 'Firefox',
          browserVersion: '142.0.0',
          osName: 'Linux',
          deviceType: 'desktop'
        },
        expiresAt
      );
      const equalLastUsedAt = clockService.addDaysFrom(now, -2);

      await Promise.all([
        repository.update(
          { id: older.id },
          {
            createdAt: clockService.addDaysFrom(now, -10),
            lastUsedAt: equalLastUsedAt
          }
        ),
        repository.update(
          { id: newer.id },
          {
            createdAt: clockService.addDaysFrom(now, -5),
            lastUsedAt: equalLastUsedAt
          }
        )
      ]);

      configService.set('MAX_ACTIVE_SESSIONS', 2);
      await sessionsService.issue(
        user.id,
        '127.0.0.3',
        {
          browserName: 'Safari',
          browserVersion: '18.0',
          osName: 'MacOS',
          deviceType: 'desktop'
        },
        expiresAt
      );

      const [storedOlder, storedNewer] = await Promise.all([
        repository.findOneByOrFail({ id: older.id }),
        repository.findOneByOrFail({ id: newer.id })
      ]);

      expect(storedOlder.isRevoked).toBe(true);
      expect(storedNewer.isRevoked).toBe(false);
    } finally {
      restoreSessionLimit(configService, previousLimit);
    }
  });
});

async function lockUser(queryRunner: QueryRunner, userId: string) {
  await queryRunner.manager
    .getRepository(User)
    .createQueryBuilder('user')
    .select('user.id')
    .where('user.id = :userId', { userId })
    .setLock('pessimistic_write')
    .getOneOrFail();
}

async function countActiveSessions(
  dataSource: DataSource,
  clockService: ClockService,
  userId: string
) {
  return dataSource.getRepository(Session).count({
    where: {
      owner: { id: userId },
      isRevoked: false,
      expiresAt: MoreThan(clockService.nowDate())
    }
  });
}

async function waitForLockWaiters(
  dataSource: DataSource,
  minimum: number,
  timeoutMs = 5_000
) {
  // This monotonic deadline controls test execution, not application time.
  const deadline = performance.now() + timeoutMs;

  while (performance.now() < deadline) {
    const [result] = await dataSource.query<{ count: number }[]>(`
      SELECT COUNT(*)::int AS "count"
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND wait_event_type = 'Lock'
        AND query ILIKE '%FOR UPDATE%'
    `);

    if (result.count >= minimum) return;
    await delay(10);
  }

  throw new Error(`Expected ${minimum} session issuances to wait for a lock`);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function restoreSessionLimit(
  configService: ConfigService,
  previousLimit: number
) {
  configService.set('MAX_ACTIVE_SESSIONS', previousLimit);
}
