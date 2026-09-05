import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/'
  }),
  rootDir: '.',
  testMatch: ['**/*.spec.ts'],
  testTimeout: 30000,
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
  transformIgnorePatterns: ['node_modules/\\.pnpm/(?!@nestjs\\+)'],
  // Jest defaults to a directory under the system temp, which CI discards
  // between runs. Keeping it in the workspace lets the pipeline restore the
  // ts-jest transform cache instead of re-transpiling every spec from cold.
  cacheDirectory: '<rootDir>/.jest-cache'
};

export default config;
