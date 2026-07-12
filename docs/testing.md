# Testing

This document describes the test setup that exists in the repository.

## Test Tooling

Packages:

- `jest`
- `ts-jest`
- `@nestjs/testing`
- `supertest`
- `@types/jest`
- `@types/supertest`

Configs:

- [jest.config.ts](../jest.config.ts): general Jest config.
- [jest.unit.config.ts](../jest.unit.config.ts): unit specs, `**/*.spec.ts`.
- [jest.e2e.config.ts](../jest.e2e.config.ts): e2e specs, `**/*.e2e-spec.ts`.

All Jest configs use:

- `preset: 'ts-jest'`
- `testEnvironment: 'node'`
- TypeScript path alias mapping from `tsconfig.json`

## Test Scripts

From [package.json](../package.json):

| Script | Purpose |
| --- | --- |
| `pnpm run test` | Unit tests through `jest.unit.config.ts`. |
| `pnpm run test:unit` | Unit tests through `jest.unit.config.ts`. |
| `pnpm run test:watch` | Jest watch mode through `jest.config.ts`. |
| `pnpm run test:cov` | Jest coverage. |
| `pnpm run test:debug` | Jest with Node inspector. |
| `pnpm run test:e2e` | E2E tests through `jest.e2e.config.ts`. |

## Unit Tests

Current unit specs:

- [src/core/clock/clock.service.spec.ts](../src/core/clock/clock.service.spec.ts)
- [src/features/auth/auth.service.spec.ts](../src/features/auth/auth.service.spec.ts)
- [src/features/token/token.service.spec.ts](../src/features/token/token.service.spec.ts)
- [src/features/users/users.service.spec.ts](../src/features/users/users.service.spec.ts)
- [src/features/sessions/sessions.service.spec.ts](../src/features/sessions/sessions.service.spec.ts)
- [src/infrastructure/databases/redis/redis.service.spec.ts](../src/infrastructure/databases/redis/redis.service.spec.ts)
- [src/infrastructure/databases/redis/redis-lock.service.spec.ts](../src/infrastructure/databases/redis/redis-lock.service.spec.ts)

Unit tests focus on service behavior and use mocks/fakes rather than booting the full app.

## E2E Tests

Current e2e specs:

- [test/v1/auth-register-v1.e2e-spec.ts](../test/v1/auth-register-v1.e2e-spec.ts)
- [test/v1/auth-login-v1.e2e-spec.ts](../test/v1/auth-login-v1.e2e-spec.ts)
- [test/v1/auth-refresh-v1.e2e-spec.ts](../test/v1/auth-refresh-v1.e2e-spec.ts)
- [test/v1/users-v1.e2e-spec.ts](../test/v1/users-v1.e2e-spec.ts)
- [test/v1/sessions-v1.e2e-spec.ts](../test/v1/sessions-v1.e2e-spec.ts)
- [test/v1/admin-user-v1.e2e-spec.ts](../test/v1/admin-user-v1.e2e-spec.ts)

E2E tests cover:

- Registration validation and uniqueness.
- Login by email and username.
- Invalid login attempts.
- Refresh success, refresh reuse detection, and concurrent refresh behavior.
- Current profile retrieval and profile updates.
- Session listing, current-session revocation, and terminating other sessions.
- Admin-only user listing.

## Test Application Bootstrap

File: [test/bootstrap/test-app.ts](../test/bootstrap/test-app.ts)

`createTestApp()`:

1. Sets `process.env.NODE_ENV = 'test'`.
2. Creates a testing module with `AppModule`.
3. Creates a Nest application.
4. Calls `setupApp(app)`.
5. Calls `app.init()`.
6. Enables shutdown hooks.
7. Returns the app and TypeORM `DataSource`.

## Test Helpers

### ApiClient

File: [test/helpers/api-client.helper.ts](../test/helpers/api-client.helper.ts)

Wraps `supertest.agent(app.getHttpServer())` and provides:

- `get`
- `post`
- `patch`
- `put`
- `delete`

Each method accepts optional headers, query, and body.

### PostgreSQL Helpers

File: [test/helpers/postgresql.helper.ts](../test/helpers/postgresql.helper.ts)

Functions:

- `runMigrations(dataSource)`
- `truncateDatabase(dataSource)`

`truncateDatabase()` truncates all TypeORM entity tables with `RESTART IDENTITY CASCADE`.

### Redis Helper

File: [test/helpers/redis.helper.ts](../test/helpers/redis.helper.ts)

`clearRedis(app)` gets `RedisService` from Nest and calls `flushdb()`.

### Factories

Files:

- [test/factories/user.factory.ts](../test/factories/user.factory.ts)
- [test/factories/auth.factory.ts](../test/factories/auth.factory.ts)

`UserFactory` registers users through the real API. `UserFactory.admin()` registers a user and updates the database role to `ADMIN`.

`AuthFactory` registers and logs in users, then extracts refresh and CSRF cookies for subsequent requests.

## Dockerized E2E Tests

File: [docker/test/e2e/docker-compose.yml](../docker/test/e2e/docker-compose.yml)

Services:

- `app`: Docker `test` target.
- `postgres`: `postgres:17-alpine`, exposed as host port `5433`.
- `redis`: `redis:7-alpine`, exposed as host port `6380`.

The app container runs [docker-entrypoint-test.sh](../docker-entrypoint-test.sh):

1. `pnpm run build`
2. `pnpm run migration:run`
3. `pnpm run test:e2e`

## CI

File: [.github/workflows/ci.yml](../.github/workflows/ci.yml)

CI runs:

1. Enable Corepack.
2. Setup Node 22.
3. `pnpm install --frozen-lockfile`.
4. `pnpm run lint`.
5. `pnpm run build`.
6. `pnpm run test:unit`.
7. Dockerized e2e tests.
8. Docker Compose cleanup.

## Current Testing Gaps

- No tests were found for CSRF guard behavior directly.
- No tests were found for role guard internals directly.
- No tests were found for device-detection middleware.
- No tests were found for `GlobalExceptionFilter`.
- No tests were found for Swagger output.
- Coverage thresholds are not configured.
