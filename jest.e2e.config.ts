import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';

/**
 * Spec files run in parallel, each worker against its own Postgres database and
 * Redis database index (see test/setup). The cap keeps the worker count within
 * the 15 usable Redis databases and leaves headroom for Postgres connections,
 * since every worker holds a pool per running application.
 */
const MAX_WORKERS = 8;

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
  maxWorkers: MAX_WORKERS,
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
