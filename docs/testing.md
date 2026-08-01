# Testing

## Tooling

| Tool | Purpose |
|------|---------|
| Jest 29 | Test runner |
| ts-jest | TypeScript compilation |
| `@nestjs/testing` | NestJS module bootstrapping |
| supertest | HTTP assertions |

## Configuration

Three Jest configs:

| Config | Purpose |
|--------|---------|
| `jest.unit.config.ts` | Unit tests (colocated `*.spec.ts`) |
| `jest.e2e.config.ts` | E2E tests (under `test/v1/`) |
| `jest.config.ts` | Combined (all specs) |

## Test Location

### Unit Tests

Unit tests are **colocated** inside an `__tests__/` directory at the same level as the implementation file:

```
application/
├── use-cases/
│   ├── __tests__/
│   │   ├── login.use-case.spec.ts
│   │   ├── register.use-case.spec.ts
│   │   └── refresh.use-case.spec.ts
│   ├── login.use-case.ts
│   ├── register.use-case.ts
│   └── refresh.use-case.ts
├── services/
│   ├── __tests__/
│   │   └── auth-cookie.service.spec.ts
│   └── auth-cookie.service.ts
└── mappers/
    ├── __tests__/
    │   └── user.mapper.spec.ts
    └── user.mapper.ts
```

This pattern is consistent across all modules:
- `repositories/__tests__/` → Repository tests
- `services/__tests__/` → Service tests
- `use-cases/__tests__/` → Use case tests
- `mappers/__tests__/` → Mapper tests

### E2E Tests

E2E tests live under `test/v1/` and follow the API version:
```
test/
├── bootstrap/test-app.ts          # createTestApp() utility
├── factories/
│   ├── auth.factory.ts            # login + authenticated helpers
│   └── user.factory.ts            # register, verifyEmail, admin helpers
├── helpers/
│   ├── api-client.helper.ts       # ApiClient (get/post/patch/put/delete)
│   ├── create-user.helper.ts      # createUserDto()
│   ├── postgresql.helper.ts       # truncateDatabase
│   └── redis.helper.ts            # clearRedis
├── setup/
│   ├── global-setup.ts            # per-worker database migration
│   ├── migrations.ts
│   ├── worker-context.ts
│   └── worker-env.ts              # per-worker env normalization
├── utils/
│   ├── cookie.util.ts             # getCookie, getCookieValue, normalizeHeader
│   └── types/                     # auth.types, factory.types, user.types
├── v1/
│   ├── admin-user-v1.e2e-spec.ts
│   ├── auth-change-password-v1.e2e-spec.ts
│   ├── auth-login-v1.e2e-spec.ts
│   ├── auth-refresh-v1.e2e-spec.ts
│   ├── auth-register-v1.e2e-spec.ts
│   ├── auth-status-v1.e2e-spec.ts
│   ├── coin-tracker-v1.e2e-spec.ts
│   ├── csrf-v1.e2e-spec.ts
│   ├── sessions-v1.e2e-spec.ts
│   ├── users-delete-account-v1.e2e-spec.ts
│   ├── users-v1.e2e-spec.ts
│   └── validation-hardening-v1.e2e-spec.ts
└── integration/
    ├── redis-lock.e2e-spec.ts
    └── session-limit.e2e-spec.ts
```

## Unit Test Patterns

### Use Case Tests

Use cases are tested by direct instantiation with mocked dependencies (no `TestingModule`):

```typescript
import { Register } from '../register.use-case';

describe('Register', () => {
  let useCase: Register;

  const mockHashingProvider = {
    hash: jest.fn()
  };

  const mockInitiateRegistration = {
    execute: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new Register(
      mockHashingProvider as any,
      mockInitiateRegistration as any
    );
  });

  it('should hash the password and initiate registration', async () => {
    // ...
  });
});
```

Key patterns:
- Mocks are plain objects with `jest.fn()` methods
- Use case is instantiated directly with `new` (not `TestingModule`)
- Mock objects cast with `as any` or `as unknown as TargetType`
- `mockDataSource.transaction` stubbed to execute the callback synchronously
- `jest.clearAllMocks()` in `beforeEach`

### Service Tests

Services that depend on Nest providers use `Test.createTestingModule()`:

```typescript
import { Test } from '@nestjs/testing';

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: REDIS_CLIENT, useValue: mockClient }
      ]
    }).compile();

    service = module.get(RedisService);
  });
});
```

### Repository Tests

Repositories use `TypeOrmModule` with a test database or mocked query runner.

## E2E Test Patterns

### Bootstrap

`createTestApp()` in `test/bootstrap/test-app.ts`:
1. Sets `NODE_ENV=test`
2. Creates `AppModule` via `Test.createTestingModule`, overriding `REDIS_CLIENT` with a test Redis client
3. Overrides `EmailService` with a capturing test double (`test/helpers/email.helper.ts`) so no real SMTP connection is attempted
4. Calls `setupApp()` for global configuration and listens on an ephemeral port
5. Returns `{ app, dataSource }`

Database schema preparation (migrations) happens once per worker in the Jest global setup (`test/setup/global-setup.ts`).

Database schema preparation (migrations) happens once per worker in the Jest global setup (`test/setup/global-setup.ts`).

### Factories

**UserFactory**:
- `UserFactory.register(app, overrides?)` → registers via `POST /v1/auth/register`, returns `{ user, client, response }`
- `UserFactory.verifyEmail(app, email)` → promotes user to `ACTIVATE` directly via repository
- `UserFactory.admin(app, dataSource, overrides?)` → registers then promotes role to `ADMIN`

**AuthFactory**:
- `AuthFactory.login(context, loginBy?)` → logs in via `POST /v1/auth/login`, captures `refresh_token`/`csrf_token` cookies and `X-CSRF-Token` header
- `AuthFactory.authenticated(app, options?, dataSource?)` → register + verifyEmail + login in one step; `dataSource` is required when `options.withRole` is `ADMIN`

### Helpers

- `ApiClient(app)` → supertest wrapper with cookie jar; `get`/`post`/`patch`/`put`/`delete` with `headers`, `query`, `body` config
- `postgresql.helper.ts` → `truncateDatabase()`
- `redis.helper.ts` → `clearRedis(app)` (flushes the Redis DB)
- `email.helper.ts` → captures emails sent by the app; `getVerificationCode(to)`, `getVerificationTtlMinutes(to)`, `getVerificationEmailCount(to)`, `resetEmailStore()`

## Running Tests

```bash
# Unit tests only
pnpm run test:unit

# E2E tests (requires running PostgreSQL + Redis)
pnpm run test:e2e

# Dockerized E2E
pnpm run test:e2e:docker

# Specific test file
npx jest --no-coverage --testPathPattern 'unsuspend-user.use-case'

# All users module tests
npx jest --no-coverage --testPathPattern 'src/features/users'
```

## CI Pipeline

Two jobs run in parallel:

```
quality:  corepack enable → pnpm install --frozen-lockfile --prefer-offline
            → lint (eslint, no --fix)
            → typecheck (tsc --noEmit)
            → unit tests (jest --config jest.unit.config.ts)

e2e:      buildx (cached layers) → production image + image contract
            → e2e image (test target)
            → postgres + redis (--wait on healthchecks)
            → migrations from the production image
            → dockerized e2e (docker-compose -f docker/test/e2e)
            → cleanup
```

`nest build` is not run on the runner: the production image builds the same
output in its `builder` stage, and the image contract asserts the result.

## Current Test Coverage

| Area | Test Files | Type |
|------|-----------|------|
| Auth | register, login, refresh, change-password use cases | Unit |
| Sessions | issue, rotation, revocation use cases; cursor, list, query services; repository | Unit |
| Token | issue, verification, validation services | Unit |
| Users | create, update, delete, suspend, unsuspend, admin, initiate-registration, verify-email, resend-verification, cleanup-pending use cases; query service, repository | Unit |
| Auth E2E | register, login, refresh, change-password, status enforcement | E2E |
| Sessions E2E | list, revoke, pagination, session limit concurrency | E2E |
| Security E2E | CSRF protection | E2E |
| Users E2E | profile, delete account, admin operations | E2E |
| Infrastructure | clock service, Redis services, env schema | Unit |
| Infinity | validation hardening | E2E |
| Coin Tracker | sync, price check, alerts | E2E |
