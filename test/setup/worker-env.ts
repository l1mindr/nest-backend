import {
  MAX_E2E_WORKERS,
  loadTestEnv,
  workerDatabaseName,
  workerMongoDatabaseName
} from './worker-context';

/**
 * Points each Jest worker at its own Postgres database, Redis database index,
 * and MongoDB database before any application module is imported, which is what
 * makes parallel spec files safe: `truncateDatabase`, `clearRedis`, and
 * `deleteMany` then only ever reset state owned by the current worker.
 */
loadTestEnv();

const workerId = Number(process.env.JEST_WORKER_ID ?? '1');

if (workerId > MAX_E2E_WORKERS) {
  throw new Error(
    `Jest worker ${workerId} exceeds the ${MAX_E2E_WORKERS} available Redis databases; lower maxWorkers in jest.e2e.config.ts.`
  );
}

process.env.DATA_SOURCE_DATABASE = workerDatabaseName(workerId);
process.env.REDIS_DB = String(workerId);
process.env.MONGODB_DATABASE = workerMongoDatabaseName(workerId);
