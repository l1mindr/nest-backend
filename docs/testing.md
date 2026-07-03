# Testing Architecture

This document describes the project's testing architecture: the `ApiClient` abstraction, test factories (UserFactory / AuthFactory separation), database reset strategies, migration runner usage, and the end-to-end (E2E) testing flow.

---

## Goals

- Make tests fast, reliable, and easy to reason about.
- Keep unit tests isolated with fast fakes; exercise integration and E2E tests against realistic stacks.
- Provide deterministic setup/teardown for database state and external dependencies.

---

## ApiClient Abstraction

Purpose:
- Centralize HTTP calls used by tests and provide helpers for auth, cookies, headers, and replayable request patterns.

Why use it:
- Keeps tests concise: tests call `apiClient.post('/login', body)` rather than duplicating header/cookie parsing logic.
- Encapsulates authentication steps (attach access token or send cookie), CSRF token handling, and expected response normalization.
- Makes switching between in-process request drivers (`supertest`/Nest `INestApplication`) and external HTTP (spun server) transparent.

Typical responsibilities:
- `post(path, body, opts)`, `get(path, opts)`, `put`, `delete` helpers.
- `loginAs(user)` helper that performs login and stores returned tokens/cookies for subsequent calls.
- Automatic JSON parsing and error normalization.
- Optional retry/backoff for flaky external calls during CI.

Implementation notes:
- Built on top of `supertest` for in-process tests or `axios`/`node-fetch` for external server tests.
- Keep ApiClient lightweight and provide per-test instances to avoid shared mutable state.

---

## Factories (UserFactory, AuthFactory)

Separation:
- `UserFactory` is responsible for creating user data records (persisted to DB) and any domain-first defaults (roles, sample profile).
- `AuthFactory` focuses on authentication-related artifacts: creating sessions, issuing tokens, or returning pre-signed tokens for tests.

Why separate:
- Clear responsibilities: user data vs authentication state (sessions/tokens).
- Tests that only need a user record don't need to also create sessions; keep setup minimal and explicit.

Factory features:
- Deterministic defaults with overrides: `UserFactory.create({ email: 'x' })`.
- Support `build()` (in-memory object) and `create()` (persisted to test DB) semantics.
- Use lightweight fixtures or fixtures + faker for randomization.
- Factories should be async-friendly and use the project's repositories/services to create records (so creation paths match real app behavior).

---

## Database Reset Strategy

Principles:
- Unit tests: use fast fakes/mocks where possible and avoid touching DB.
- Integration/E2E tests: run against an isolated test database and reset state between tests to ensure determinism.

Approaches:
1. Transactional tests (fastest where supported):
   - Start a DB transaction at test start and rollback at test end. Works well for single-process unit/integration tests.
   - Caveat: doesn’t work for multi-process tests (e.g., when server runs in a separate process) unless you use savepoints carefully.

2. Truncate/clean tables between tests (recommended for E2E):
   - Use `TRUNCATE TABLE ... CASCADE` on known tables in a clean-up step.
   - Faster if you disable and re-enable triggers where necessary and use `TRUNCATE` rather than `DELETE`.

3. Recreate schema per test suite (safe, slower):
   - Drop and recreate schema or restore from a prepared snapshot for full isolation in CI.

Recommendations for this project:
- Use migrations to create schema in CI/local once.
- For Jest unit/integration tests running in-process: use transactions where possible and rollback after each test.
- For Jest E2E tests that run against a server process: use a `truncate`-based reset between test cases or spin up ephemeral DB instances (e.g., Testcontainers or container-per-suite) for maximal isolation.
- Keep a `test/helpers/db-reset.ts` helper shared by tests to perform resets reliably.

---

## Migration Runner Usage in Tests/CI

- Ensure the database schema is current before running integration and E2E tests.
- Use the existing npm scripts (`yarn build && yarn migration:run`) in CI pipeline to apply migrations to the test DB.
- In local development, provide a script `yarn test:migrate` that builds and runs migrations against a local test database.

CI flow example:

1. Start test DB (service or container).
2. `yarn build` (compile TS)
3. `yarn migration:run` (apply migrations)
4. Start application or test runner.
5. Run tests.

Notes:
- Keep migrations deterministic and review generated SQL before committing.
- For speed, use a DB snapshot or template DB where possible to avoid running all migrations on every CI job.

---

## E2E Testing Flow

Goals:
- Validate the full stack: HTTP, controllers, services, infrastructure integrations (DB, Redis), and auth flows.

Typical E2E steps:
1. Build the project: `yarn build`.
2. Start dependencies: Postgres, Redis (use docker-compose or Testcontainers in CI).
3. Apply migrations: `yarn migration:run`.
4. Start the app in test mode: `NODE_ENV=test node dist/main.js` or use Nest's testing utilities to bootstrap an in-process `INestApplication`.
5. Use `ApiClient` to run test scenarios: register, login, token flow, session rotation, protected endpoints, revocation.
6. Reset DB between test suites or cases as per strategy (truncate or recreate schema).
7. Collect coverage and teardown containers.

Parallelization:
- Tests can be parallelized by running multiple isolated DB instances (CI matrix) or by using testcontainers to spin DB per worker.
- Avoid running multiple test workers against a single shared DB unless tests guarantee isolation.

Best practices:
- Seed minimal required data per test; prefer factories over global seeds.
- Keep E2E scenarios focused and deterministic.
- Add explicit timeouts and retries for flaky external dependencies (service start, migrations).

---

## Utilities and Helpers

- `test/helpers/api-client.ts` — ApiClient implementation used across tests.
- `test/factories/*` — factory implementations for `UserFactory`, `AuthFactory`, `SessionFactory`.
- `test/helpers/db-reset.ts` — DB reset helper used by Jest `beforeEach`/`afterEach` hooks.
- `test/bootstrap/` — common test setup and global fixtures.

---

## Observability and Flakiness

- Log test-specific diagnostics (query times, slow endpoints) when failures occur.
- When flakiness appears, capture stack traces, recent DB state, and request/response pairs to diagnose.
- Provide CI artifacts (logs, DB dump) for failed E2E runs.

---

## Summary

- Use `ApiClient` to keep tests concise and consistent.
- Separate data creation (`UserFactory`) from authentication/session setup (`AuthFactory`).
- Prefer transactions for fast in-process tests and truncate or ephemeral DBs for E2E isolation.
- Run migrations before tests in CI and consider DB template/snapshots for speed.
- Keep E2E tests deterministic and isolated; instrument for flaky test diagnostics.
