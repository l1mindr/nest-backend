import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';
import { MAX_E2E_WORKERS } from './test/setup/worker-context';

/**
 * Spec files run in parallel, each worker against its own Postgres database and
 * Redis database index (see test/setup).
 *
 * The binding limit is memory, not CPU or the Redis database count. Every
 * worker boots a whole Nest app — Postgres pool, Redis, Mongo, BullMQ — and
 * Node sizes each worker's heap from the machine's *total* memory, so workers
 * each grow as though they owned the box rather than a share of it. Measured
 * against this suite in the containerised lane, peak resident memory is roughly
 * 1.9 GB per worker: 2 workers peak near 3.9 GB and 3 near 5.2 GB, while 4 or
 * more exhaust an 8 GB Docker host badly enough that the kernel SIGKILLs
 * workers mid-`beforeAll`. Jest surfaces that as "Test suite failed to run" and
 * hook timeouts, which reads like a flaky application and is not one.
 *
 * A GitHub Actions standard runner is 2 vCPU / 7 GB, so 2 is the highest count
 * that still leaves headroom there. Deliberately not derived from the CPU count:
 * the runners report far more cores than their memory can support workers.
 * E2E_MAX_WORKERS raises it on a host with more memory to spare — the hard
 * ceiling stays the usable Redis databases, one per worker.
 */
const DEFAULT_MAX_WORKERS = 2;

function resolveMaxWorkers(): number {
  const configured = process.env.E2E_MAX_WORKERS;

  if (configured === undefined || configured === '') {
    return DEFAULT_MAX_WORKERS;
  }

  const workers = Number(configured);

  if (!Number.isInteger(workers) || workers < 1) {
    throw new Error(
      `E2E_MAX_WORKERS must be a positive integer, received "${configured}".`
    );
  }

  if (workers > MAX_E2E_WORKERS) {
    throw new Error(
      `E2E_MAX_WORKERS=${workers} exceeds the ${MAX_E2E_WORKERS} available Redis databases.`
    );
  }

  return workers;
}

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/'
  }),
  rootDir: '.',
  testMatch: ['**/*.e2e-spec.ts'],
  testTimeout: 30000,
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  setupFiles: ['<rootDir>/test/setup/worker-env.ts'],
  maxWorkers: resolveMaxWorkers(),
  // @nestjs/* ships ESM-only as of v12 (no CJS build), so its files reach
  // Jest's CJS module loader as raw `import` syntax unless transpiled here;
  // everything else in node_modules is still plain CJS and stays ignored.
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': '<rootDir>/test/setup/nestjs-esm.transformer.js'
  },
  // pnpm flattens packages into node_modules/.pnpm/<name>@<version>/... with
  // scoped names' `/` replaced by `+` (e.g. `@nestjs+common@12.0.1_.../`), so
  // the allowlist has to match against that store-key form, not `@nestjs/`.
  transformIgnorePatterns: ['node_modules/\\.pnpm/(?!@nestjs\\+)']
};

export default config;
