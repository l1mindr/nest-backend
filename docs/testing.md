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
| `jest.e2e.config.ts` | E2E tests (`**/*.e2e-spec.ts` under `test/v1/`, `test/email/`, `test/integration/`) |
| `jest.config.ts` | Combined (all specs) |

### E2E parallelism

`jest.e2e.config.ts` sets `maxWorkers` from `E2E_MAX_WORKERS`, defaulting to
**2**. The value is validated and capped at the 15 usable Redis databases, since
`test/setup/worker-env.ts` gives each worker its own Redis database index
alongside its own Postgres and MongoDB databases.

The bound is memory, not CPU. Each worker boots a whole Nest application and Node
sizes each worker's heap from the machine's *total* memory, so workers each grow
as though they owned the box — roughly 1.9 GB resident each for this suite. Above
two on an 8 GB Docker host the kernel starts SIGKILLing workers mid-`beforeAll`,
which Jest reports as `Test suite failed to run` and hook timeouts.

**When a containerised run goes red, grep it for `SIGKILL` first.** That single
string separates resource starvation from a real regression. See
[ci.md](ci.md) and [docker.md](docker.md).

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
├── email/                         # delivered-email specs (need Mailpit)
│   ├── verification-email-mailpit.e2e-spec.ts
│   ├── admin-invitation-email-mailpit.e2e-spec.ts
│   ├── price-alert-email-mailpit.e2e-spec.ts
│   └── email-retry-backoff.e2e-spec.ts
├── helpers/
│   ├── api-client.helper.ts       # ApiClient (get/post/patch/put/delete)
│   ├── create-user.helper.ts      # createUserDto()
│   ├── email-queue.helper.ts      # observeEmailProcessor, emailQueue
│   ├── log-capture.helper.ts      # captureApplicationLogs
│   ├── mailpit.helper.ts          # Mailpit API client, uniqueRecipient
│   ├── postgresql.helper.ts       # truncateDatabase
│   ├── rate-limit.helper.ts       # counterKeyFor, blockKeyFor, resetPolicy, forceExpiry
│   ├── redis.helper.ts            # clearRedis
│   ├── secret-leak.helper.ts      # expectNoSecrets
│   └── smtp-stub.server.ts        # scripted SMTP server for retry/backoff
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
│   ├── rate-limit-v1.e2e-spec.ts
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

`createTestApp(options?)` in `test/bootstrap/test-app.ts`:
1. Sets `NODE_ENV=test`
2. Creates `AppModule` via `Test.createTestingModule`, overriding `REDIS_CLIENT` with a test Redis client
3. Overrides `EmailService` and `EmailPublisher` with capturing test doubles (`test/helpers/email.helper.ts`) so no queue job is written and no SMTP connection is attempted
4. Calls `setupApp()` for global configuration and listens on an ephemeral port
5. Returns `{ app, dataSource }`

`options.email` selects which email pipeline runs:

| Mode                    | What the application does                                              |
| ----------------------- | ---------------------------------------------------------------------- |
| `'captured'` (default)  | Queue and provider both replaced; a send is observable synchronously    |
| `'delivered'`           | The real one — `BullEmailPublisher` → BullMQ → `EmailProcessor` → SMTP  |

`options.smtpTransport` replaces only the transport within a `delivered` run,
which is how the retry spec chooses the server's replies. A `delivered` run
opens pooled SMTP sockets, so it must call `releaseSmtpTransport(app)` before
`app.close()` or the Jest worker will not exit.

Database schema preparation (migrations) happens once per worker in the Jest global setup (`test/setup/global-setup.ts`).

### Factories

**UserFactory**:
- `UserFactory.register(app, overrides?)` → registers via `POST /v1/auth/register`, returns `{ user, client, response }`
- `UserFactory.verifyEmail(app, email)` → activates the user directly via repository
- `UserFactory.admin(app, dataSource, overrides?, permissions?)` → registers, then elevates the role to `ADMIN` and grants permissions directly via repository (a test shortcut — production uses the invitation flow); permissions default to the full set

**AuthFactory**:
- `AuthFactory.login(context, loginBy?)` → logs in via `POST /v1/auth/login`, captures `refresh_token`/`csrf_token` cookies and `X-CSRF-Token` header
- `AuthFactory.authenticated(app, options?, dataSource?)` → register + verifyEmail + login in one step; `dataSource` is required when `options.withRole` is `ADMIN`

### Helpers

- `ApiClient(app)` → supertest wrapper with cookie jar; `get`/`post`/`patch`/`put`/`delete` with `headers`, `query`, `body` config
- `postgresql.helper.ts` → `truncateDatabase()`
- `redis.helper.ts` → `clearRedis(app)` (flushes the Redis DB)
- `email.helper.ts` → captures emails sent by the app; `getVerificationCode(to)`, `getVerificationTtlMinutes(to)`, `getVerificationEmailCount(to)`, `resetEmailStore()`
- `mailpit.helper.ts` → reads the mailbox Mailpit received; `uniqueRecipient(prefix)`, `waitForMessages(to, n)`, `raw(id)`, `deleteMessagesTo(to)`
- `email-queue.helper.ts` → `observeEmailProcessor()` records every `EmailProcessor.process` attempt (job, attempt number, start time, outcome) without replacing it
- `log-capture.helper.ts` → `captureApplicationLogs()` records everything passed to `PinoLogger`, for asserting a secret never reaches a log line
- `secret-leak.helper.ts` → `expectNoSecrets(text, what, extra?)`; reports *names*, never values, so a failure message cannot publish the secret
- `smtp-stub.server.ts` → a real SMTP server whose reply to each submission the spec scripts (`451`, `550`, `250`)

### Delivered-email E2E (Mailpit)

Everything under `test/v1/` stops at the publisher: `EmailPublisher` and
`EmailService` are replaced, so the assertion is that a use case *decided* to
send. That is the right default — delivery is asynchronous and a spec that had
to wait for a queue worker to finish before checking a status code would be slow
and flaky for no gain.

It leaves the second half untested, which is what `test/email/` covers. Those
specs run with `email: 'delivered'`, so the message crosses BullMQ, is rendered
by `SmtpEmailService`, is delivered over real SMTP by nodemailer, and is then
read back out of Mailpit over its HTTP API. Nothing between the HTTP request and
the mailbox is substituted.

| Spec                                       | Flow                                                        |
| ------------------------------------------ | ----------------------------------------------------------- |
| `verification-email-mailpit.e2e-spec.ts`   | register → delivered code → `POST /v1/auth/verify-email`     |
| `admin-invitation-email-mailpit.e2e-spec.ts` | invite → delivered token → `POST .../invitations/accept`   |
| `price-alert-email-mailpit.e2e-spec.ts`    | alert crosses its target → delivered notification            |
| `email-retry-backoff.e2e-spec.ts`          | 4xx retried with growing backoff; 5xx not retried            |

They need Mailpit listening on the SMTP and API ports named in `.env.test`:

```bash
docker compose -f ../docker/compose.yml up -d mailpit
```

Without it the specs fail immediately with an explanation rather than timing
out one assertion at a time.

Three things they are careful about, worth preserving in anything added there:

- **Unique recipients.** One Mailpit instance serves every Jest worker, so every
  lookup is scoped to a `uniqueRecipient()` address and cleanup deletes only
  those messages. Nothing reads "the latest message" or clears the mailbox.
- **Secrets are named, never printed.** `expectNoSecrets` reports which
  configured value leaked, not the value — a Jest diff ends up in CI logs, and
  one that quotes an app password has published it.
- **Provenance is asserted, not assumed.** A message in Mailpit proves SMTP
  happened, not what dialled it. `observeEmailProcessor()` records the job the
  BullMQ worker was handed, so "the queue delivered this" is checked directly.

The retry spec drives an SMTP server it scripts (`smtp-stub.server.ts`) rather
than breaking something real: a refused port, a stopped container and a dropped
packet each produce a different error at a different layer, none of them on
demand.

## Running Tests

```bash
# Unit tests only
pnpm run test:unit

# E2E tests (requires running PostgreSQL + Redis + MongoDB, and Mailpit for
# the test/email/ specs)
docker compose -f ../docker/compose.yml up -d mailpit
pnpm run test:e2e

# Just the delivered-email specs
npx jest --config jest.e2e.config.ts test/email

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
            → postgres + redis + mongo + mailpit (--wait on healthchecks)
            → migrations from the production image
            → dockerized e2e (docker-compose -f docker/test/e2e, E2E_MAX_WORKERS=2)
            → cleanup (down -v, always)
```

`mailpit` is started because the E2E run uses `--no-deps` and the `test/email/`
specs need an SMTP server that accepts a message and serves it back.

`nest build` is not run on the runner: the production image builds the same
output in its `builder` stage, and the image contract asserts the result.

[ci.md](ci.md) documents the workflow in full.

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
