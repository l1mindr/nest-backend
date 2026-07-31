import { DataSource } from 'typeorm';
import { E2E_MIGRATIONS } from './migrations';
import {
  MAX_E2E_WORKERS,
  loadTestEnv,
  postgresConnection,
  workerDatabaseName
} from './worker-context';

/** Only the fields this hook needs from Jest's global configuration. */
interface GlobalSetupConfig {
  maxWorkers: number;
}

/**
 * Provisions one database per Jest worker so spec files can run in parallel
 * without their `TRUNCATE` in `beforeEach` wiping another worker's rows.
 *
 * Databases are reused between runs: migrations are versioned and idempotent,
 * so recreating them every time would only add cost.
 */
export default async function globalSetup(
  globalConfig: GlobalSetupConfig
): Promise<void> {
  loadTestEnv();

  const workers = Math.min(globalConfig.maxWorkers, MAX_E2E_WORKERS);

  const dataSource = new DataSource({
    type: 'postgres',
    ...postgresConnection(),
    database: 'postgres',
    entities: [],
    migrations: []
  });

  await dataSource.initialize();

  const databases: string[] = [];

  try {
    for (let workerId = 1; workerId <= workers; workerId++) {
      const database = workerDatabaseName(workerId);

      await createDatabaseIfMissing(dataSource, database);
      databases.push(database);
    }
  } finally {
    await dataSource.destroy();
  }

  // Migrating here means each worker database is prepared exactly once per run
  // instead of once per spec file.
  await Promise.all(databases.map(migrateDatabase));
}

async function migrateDatabase(database: string): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    ...postgresConnection(),
    database,
    entities: [],
    migrations: E2E_MIGRATIONS
  });

  await dataSource.initialize();

  try {
    // CreateUsersTable1700000000000 defaults its primary key to
    // uuid_generate_v4(), but the extension providing it is only created by the
    // next migration. Existing environments were provisioned with it out of
    // band; a freshly created worker database needs it up front.
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}

async function createDatabaseIfMissing(
  dataSource: DataSource,
  database: string
): Promise<void> {
  const existing: unknown[] = await dataSource.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [database]
  );

  if (existing.length > 0) return;

  // CREATE DATABASE accepts no bind parameters, so the identifier is quoted.
  await dataSource.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
}
