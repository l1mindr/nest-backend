import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import { resolve } from 'path';

/**
 * Redis ships with databases 0-15. Database 0 is deliberately left to local
 * development so an E2E run never flushes a developer's working data.
 */
export const MAX_REDIS_DATABASES = 16;

export const MAX_E2E_WORKERS = MAX_REDIS_DATABASES - 1;

const ENV_TEST_PATH = resolve(__dirname, '../../.env.test');

/**
 * `.env.test` is normally read by ConfigModule once the application boots, but
 * the Jest global setup and per-worker setup need the connection details before
 * any module exists. dotenv never overrides variables that are already present,
 * so an explicit `DATA_SOURCE_DATABASE=... pnpm test:e2e` still wins.
 */
export function loadTestEnv(): void {
  dotenvExpand.expand(dotenv.config({ path: ENV_TEST_PATH, quiet: true }));
}

/**
 * Captured the first time it is read so the name can be derived repeatedly
 * without compounding suffixes: `setupFiles` runs once per spec file, not once
 * per worker, and workers are reused across files.
 */
export function baseDatabaseName(): string {
  const base =
    process.env.E2E_DATABASE_BASE ?? process.env.DATA_SOURCE_DATABASE;

  if (!base) {
    throw new Error(
      'DATA_SOURCE_DATABASE is not set; cannot derive the E2E worker databases.'
    );
  }

  process.env.E2E_DATABASE_BASE = base;

  return base;
}

export function workerDatabaseName(workerId: number): string {
  return `${baseDatabaseName()}_w${workerId}`;
}

export function postgresConnection() {
  return {
    host: process.env.DATA_SOURCE_HOST,
    port: Number(process.env.DATA_SOURCE_PORT),
    username: process.env.DATA_SOURCE_USERNAME,
    password: process.env.DATA_SOURCE_PASSWORD
  };
}
