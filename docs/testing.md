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
│   ├── auth.factory.ts            # register + login helpers
│   └── user.factory.ts            # user creation helpers
├── helpers/
│   ├── postgresql.helper.ts       # runMigrations, truncateDatabase
│   └── redis.helper.ts            # flushRedis
├── v1/
│   ├── admin-user-v1.e2e-spec.ts
│   ├── auth-change-password-v1.e2e-spec.ts
│   ├── auth-refresh-v1.e2e-spec.ts
│   ├── auth-status-v1.e2e-spec.ts
│   ├── coin-tracker-v1.e2e-spec.ts
│   ├── csrf-v1.e2e-spec.ts
│   ├── session-limit.e2e-spec.ts
│   ├── sessions-v1.e2e-spec.ts
│   ├── users-delete-account-v1.e2e-spec.ts
│   ├── users-v1.e2e-spec.ts
│   └── validation-hardening-v1.e2e-spec.ts
└── integration/
    └── session-limit-concurrency.e2e-spec.ts
```

## Unit Test Patterns

### Use Case Tests

Use cases are tested by direct instantiation with mocked dependencies (no `TestingModule`):

```typescript
import { UserErrors } from '../../../domain/errors/user-errors';
import { RegisterUseCase } from '../register.use-case';

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;

  const mockUserRepository = {
    findByEmailOrUsername: jest.fn(),
    insertUser: jest.fn()
  };

  const mockHashingProvider = {
    hash: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new RegisterUseCase(
      mockUserRepository as any,
      mockHashingProvider as any
    );
  });

  it('should register a new user', async () => {
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
2. Creates `AppModule` via `Test.createTestingModule`
3. Calls `setupApp()` for global configuration
4. Returns `{ app, dataSource }`

### Factories

**UserFactory** — Registers users via API:
- `UserFactory.register(app)` → returns `{ user, client }`
- `UserFactory.admin(app)` → promotes user to `ADMIN`
- `UserFactory.verifyEmail(app, email)` → verifies via repository

**AuthFactory** — Registers + logs in:
- `AuthFactory.registerAndLogin(app)` → returns context with cookies

### Helpers

- `testApi(app)` → supertest wrapper with cookie jar
- `postgresql.helper.ts` → `runMigrations()`, `truncateDatabase()`
- `redis.helper.ts` → `flushRedis(db)`

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

```
corepack enable → pnpm install --frozen-lockfile
  → lint (eslint)
  → typecheck (tsc --noEmit)
  → build (nest build)
  → unit tests (jest --config jest.unit.config.ts)
  → build production Docker image
  → dockerized e2e (docker-compose -f docker/test/e2e)
  → cleanup
```

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
