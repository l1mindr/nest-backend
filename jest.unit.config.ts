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
  // Jest defaults to a directory under the system temp, which CI discards
  // between runs. Keeping it in the workspace lets the pipeline restore the
  // ts-jest transform cache instead of re-transpiling every spec from cold.
  cacheDirectory: '<rootDir>/.jest-cache'
};

export default config;
