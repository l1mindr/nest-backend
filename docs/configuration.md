# Configuration

## Environment Module

`EnvModule` (in `infrastructure/config/env/`) registers `ConfigModule.forRoot()` globally with Joi schema validation.

Reads `.env.${NODE_ENV}`, then `.env` (`.env` overrides).

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATA_SOURCE_USERNAME` | PostgreSQL username |
| `DATA_SOURCE_PASSWORD` | PostgreSQL password |
| `DATA_SOURCE_HOST` | PostgreSQL hostname or IP |
| `DATA_SOURCE_PORT` | PostgreSQL port (1–65535) |
| `DATA_SOURCE_DATABASE` | PostgreSQL database name |
| `REDIS_HOST` | Redis hostname or IP |
| `REDIS_PORT` | Redis port (1–65535) |
| `MAX_ACTIVE_SESSIONS` | Max concurrent sessions per user (min 5) |
| `ACCESS_TOKEN_SECRET` | JWT access token signing secret (entropy-validated) |
| `REFRESH_TOKEN_SECRET` | JWT refresh token signing secret (must differ from access) |
| `CSRF_TOKEN_SECRET` | CSRF token secret (must differ from both JWT secrets) |
| `SECURITY_HASH_SECRET` | Keys the HMAC behind device identifiers and rate-limit Redis keys. **Required in production only**; defaulted elsewhere. Must differ from the three secrets above |
| `EMAIL_HOST` | SMTP hostname or IP (e.g. `smtp.gmail.com`) |
| `EMAIL_USER` | SMTP account username |
| `EMAIL_APP_PASSWORD` | SMTP app password (min 16 chars in production) |
| `EMAIL_FROM` | Sender address used in outgoing emails |
| `NODE_ENV` | One of: development, production, test, staging |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_SOURCE_POOL_SIZE` | 10 | Connection pool size (1–100) |
| `DATA_SOURCE_CONNECT_TIMEOUT_MS` | 5000 | Connection timeout in ms (1000–60000) |
| `DATA_SOURCE_IDLE_TIMEOUT_MS` | 30000 | Idle timeout in ms (1000–600000) |
| `REDIS_PASSWORD` | — | Redis password (required in production, entropy-validated) |
| `REDIS_DB` | 0 | Redis database index |
| `LOG_LEVEL` | `debug` (dev) / `warn` (prod) | One of: info, debug, warn, error, silent |
| `E2E_LOGS` | `false` | Enable request/response logging in e2e tests |
| `APP_NAME` | `NestJS Backend` | Product name used as the sender display name in emails |
| `EMAIL_PORT` | 587 | SMTP port (1–65535) |
| `EMAIL_SECURE` | `false` | Use TLS when connecting to the SMTP server |
| `OWNER_EMAIL` | — | Email for the initial Owner, required only when running `pnpm seed:owner` |
| `OWNER_PASSWORD` | — | Password for the initial Owner (8–128 chars), required only when running `pnpm seed:owner` |

## Secrets Validation

Secrets (`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `CSRF_TOKEN_SECRET`, `SECURITY_HASH_SECRET`, and production `REDIS_PASSWORD`) undergo **Shannon entropy validation** to prevent weak keys:

| Secret | Dev min length | Dev min entropy | Prod min length | Prod min entropy |
|--------|---------------|----------------|---------------|-----------------|
| `ACCESS_TOKEN_SECRET` | 32 | 3.0 bits/char | 64 | 3.5 bits/char |
| `REFRESH_TOKEN_SECRET` | 32 | 3.0 bits/char | 64 | 3.5 bits/char |
| `CSRF_TOKEN_SECRET` | 16 | 2.5 bits/char | 32 | 3.0 bits/char |
| `SECURITY_HASH_SECRET` | defaulted | — | 32 | 3.0 bits/char |
| `REDIS_PASSWORD` | optional | — | 16 | 3.0 bits/char |
| `EMAIL_APP_PASSWORD` | 8 | — | 16 | — |

### Production Safety Checks

In production mode, the schema enforces additional rules:

- `DATA_SOURCE_PASSWORD` must not match `ACCESS_TOKEN_SECRET` or `REFRESH_TOKEN_SECRET`
- `REDIS_PASSWORD` is required (non-empty)
- `REDIS_HOST` must not be localhost / 127.0.0.1 / ::1
- `ACCESS_TOKEN_SECRET` length must be at least 64 characters (defensive redundancy)
- All three token secrets (`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `CSRF_TOKEN_SECRET`) must be distinct from each other
- `EMAIL_APP_PASSWORD` must not match any of the three token secrets

## Configuration Namespaces

| Namespace | Variables | Usage |
|-----------|-----------|-------|
| `database` | host, port, username, password, database, pool size, timeouts | TypeORM data source |
| `redis` | host, port, password, db | ioredis client |
| `jwt` | accessSecret, refreshSecret | TokenIssueService, JwtStrategy |
| `csrf` | secret | CsrfTokenService |
| `app` | nodeEnv, logLevel, port | Application bootstrap |
| `email` | appName, host, port, secure, user, appPassword, from | SMTP transport (Nodemailer) |

## Validation

Joi schema validates all required variables on application startup. Missing or invalid required variables cause the application to fail to start with a descriptive error message.

## TypeScript Configuration

| Setting | Value |
|---------|-------|
| Target | ES2021 |
| Module | CommonJS |
| Strict null checks | Enabled |
| Decorators | Experimental (required by NestJS) |
| Path aliases | `@features/*`, `@infrastructure/*`, `@presentation/*`, `@core/*` |
