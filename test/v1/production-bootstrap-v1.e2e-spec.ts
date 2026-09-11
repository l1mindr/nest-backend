import { HashingProvider } from '@features/auth/infrastructure/providers/hashing.provider';
import { Session } from '@features/sessions/domain/entities/session.entity';
import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { bootstrapOwner } from '../../scripts/seed-owner';
import { createMigratedTestApp } from '../bootstrap/test-app';
import { E2E_MIGRATIONS } from '../setup/migrations';
import { baseDatabaseName, postgresConnection } from '../setup/worker-context';

/**
 * What a production-like startup actually puts in an empty database.
 *
 * The startup sequence a deployment runs is `migration:run` followed by the
 * one-shot `seed:owner` (see `docker/production/docker-compose.yml` and the
 * `migration` → `owner-bootstrap` → `backend` chain in `docker/compose.yml`).
 * This spec reproduces exactly that, against a database created for the run and
 * dropped afterwards, and asserts the resulting rows table by table.
 *
 * The assertions are deliberately written as "these tables have rows and no
 * others do" rather than as a list of things that must be absent. A future
 * migration or bootstrap step that seeds a demo portfolio, a sample user or a
 * test fixture fails here without anyone having to predict its name.
 *
 * The three populated tables are the intended ones:
 *   - `migrations` — TypeORM's own ledger.
 *   - `permission` and `role` — system reference data inserted by
 *     `CreateAuthorizationTables` / `CreateRoleTables`. The authorization model
 *     resolves grants against these, so they are required, not sample data.
 *
 * Everything else — users, portfolios, assets, coins, transactions, holdings,
 * wallets, alerts, sessions — starts empty and stays empty until somebody uses
 * the application.
 */
describe('Production Bootstrap (e2e) version: 1', () => {
  let app: INestApplication;
  let hashingProvider: HashingProvider;

  /** Connected to the throwaway database this spec provisions. */
  let scratch: DataSource;
  let database: string;

  const ownerEmail = 'owner@example.com';
  const ownerPassword = 'Owner@12345';

  /**
   * Tables a clean migration is expected to populate.
   *
   * `migrations` is bookkeeping; the other two are reference data the
   * authorization model reads. None of them describe a user, and none are
   * environment-dependent.
   */
  const REFERENCE_TABLES = ['migrations', 'permission', 'role'];

  /** Row counts for every base table in the public schema. */
  const rowCounts = async (): Promise<Record<string, number>> => {
    const tables: { table_name: string }[] = await scratch.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name`
    );

    const entries = await Promise.all(
      tables.map(async ({ table_name: table }) => {
        const [{ count }]: { count: number }[] = await scratch.query(
          `SELECT COUNT(*)::int AS count FROM "${table.replace(/"/g, '""')}"`
        );

        return [table, count] as const;
      })
    );

    return Object.fromEntries(entries);
  };

  /** Names of the tables that currently hold at least one row. */
  const populatedTables = async (): Promise<string[]> =>
    Object.entries(await rowCounts())
      .filter(([, count]) => count > 0)
      .map(([table]) => table)
      .sort();

  beforeAll(async () => {
    // Only for the password hasher: the Owner password must be produced by the
    // same Argon2id provider a real bootstrap uses, not by a stand-in.
    const { app: testApp } = await createMigratedTestApp();

    app = testApp;
    hashingProvider = app.get(HashingProvider);

    // Named per worker so parallel spec files cannot collide on it.
    database = `${baseDatabaseName()}_prodlike_w${process.env.JEST_WORKER_ID ?? '1'}`;

    const admin = new DataSource({
      type: 'postgres',
      ...postgresConnection(),
      database: 'postgres',
      entities: [],
      migrations: []
    });

    await admin.initialize();

    try {
      // Dropped first: a previous run that crashed before its teardown would
      // otherwise leave rows behind and make this spec assert on them.
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.query(`CREATE DATABASE "${database}"`);
    } finally {
      await admin.destroy();
    }

    scratch = new DataSource({
      type: 'postgres',
      ...postgresConnection(),
      database,
      // The same two entities `SeedOwnerModule` registers — `bootstrapOwner`
      // resolves the `User` repository, and `User` maps a relation to
      // `Session`. Nothing else is needed: the bootstrap touches one table,
      // which is part of what this spec exists to demonstrate.
      entities: [User, Session],
      migrations: E2E_MIGRATIONS
    });

    await scratch.initialize();

    // Matches the global setup: the first migration defaults its primary key to
    // uuid_generate_v4(), whose extension the next migration creates.
    await scratch.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  });

  afterAll(async () => {
    await scratch?.destroy();

    if (database) {
      const admin = new DataSource({
        type: 'postgres',
        ...postgresConnection(),
        database: 'postgres',
        entities: [],
        migrations: []
      });

      await admin.initialize();

      try {
        await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      } finally {
        await admin.destroy();
      }
    }

    await app?.close();
  });

  /**
   * Ordered: each step asserts the state the previous one left, so a failure
   * names the step that introduced the unexpected rows.
   */
  describe('step 1 — migrations', () => {
    it('creates system reference data and nothing else', async () => {
      await scratch.runMigrations();

      expect(await populatedTables()).toEqual([...REFERENCE_TABLES].sort());
    });

    it('leaves the account population empty', async () => {
      const counts = await rowCounts();

      expect(counts['user']).toBe(0);
      expect(counts['session']).toBe(0);
      expect(counts['user_verification_code']).toBe(0);
    });

    it('leaves every user-generated table empty', async () => {
      const counts = await rowCounts();

      // Named explicitly as well as covered by the "no other table" assertion
      // above: these are the ones a demo seed would plausibly fill.
      expect(counts['portfolio']).toBe(0);
      expect(counts['portfolio_transaction']).toBe(0);
      expect(counts['portfolio_opening_balance']).toBe(0);
      expect(counts['holding']).toBe(0);
      expect(counts['wallet']).toBe(0);
      expect(counts['price_alert']).toBe(0);
      expect(counts['admin_invitation']).toBe(0);
      expect(counts['admin_permission']).toBe(0);
      expect(counts['user_role_assignment']).toBe(0);
    });

    /**
     * The asset and coin catalogues are reference data, but they are *fetched*
     * from CoinGecko by the recurring sync job — not seeded by a migration. A
     * clean database therefore starts with neither, which is what makes the
     * catalogue a live upstream mirror rather than a fixture in the schema.
     */
    it('does not ship a hardcoded asset or coin catalogue', async () => {
      const counts = await rowCounts();

      expect(counts['asset']).toBe(0);
      expect(counts['coin']).toBe(0);
    });

    it('seeds the permissions and roles the authorization model resolves against', async () => {
      const counts = await rowCounts();

      expect(counts['permission']).toBeGreaterThan(0);
      expect(counts['role']).toBeGreaterThan(0);
    });
  });

  describe('step 2 — owner bootstrap', () => {
    it('creates exactly one account, the owner', async () => {
      const outcome = await bootstrapOwner(
        { dataSource: scratch, hashingProvider },
        ownerEmail,
        ownerPassword
      );

      expect(outcome.created).toBe(true);

      const accounts: { email: string; role: string; status: string }[] =
        await scratch.query('SELECT email, role, status FROM "user"');

      expect(accounts).toEqual([
        {
          email: ownerEmail,
          role: UserRole.OWNER,
          status: UserStatus.ACTIVATE
        }
      ]);
    });

    /**
     * The point of the whole spec: bootstrapping the Owner adds one row to one
     * table. No demo user, no sample portfolio, no fixture rides along with it.
     */
    it('adds no data beyond that account', async () => {
      expect(await populatedTables()).toEqual(
        [...REFERENCE_TABLES, 'user'].sort()
      );
    });

    it('makes no further changes when run again', async () => {
      const before = await rowCounts();

      const second = await bootstrapOwner(
        { dataSource: scratch, hashingProvider },
        ownerEmail,
        ownerPassword
      );

      expect(second.created).toBe(false);
      expect(await rowCounts()).toEqual(before);
    });
  });

  describe('the bootstrapped system', () => {
    /**
     * Issue 2 at the database level: the owner is one of the accounts, so a
     * count over the account population is 1 here and not 0.
     */
    it('counts the owner as an account', async () => {
      const [{ count }]: { count: number }[] = await scratch.query(
        'SELECT COUNT(*)::int AS count FROM "user"'
      );

      expect(count).toBe(1);
    });
  });
});
