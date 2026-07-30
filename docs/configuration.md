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
| `DATA_SOURCE_HOST` | PostgreSQL host |
| `DATA_SOURCE_PORT` | PostgreSQL port |
| `DATA_SOURCE_DATABASE` | PostgreSQL database name |
| `REDIS_HOST` | Redis host (default: localhost) |
| `REDIS_PORT` | Redis port (default: 6379) |
| `MAX_ACTIVE_SESSIONS` | Max concurrent sessions per user (default: 5) |
| `JWT_ACCESS_SECRET` | HMAC secret for access token signing |
| `JWT_REFRESH_SECRET` | HMAC secret for refresh token signing |
| `NODE_ENV` | `development`, `test`, or `production` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_PASSWORD` | - | Redis password |
| `REDIS_DB` | 0 | Redis database index |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Pino log level |
| `PORT` | 8080 | Application port (hardcoded in bootstrap.ts) |

## Configuration Namespaces

| Namespace | Variables | Usage |
|-----------|-----------|-------|
| `database` | URL, pool size, timeout | TypeORM connection |
| `redis` | host, port, password, db | ioredis client |
| `jwt` | accessSecret, refreshSecret | TokenIssueService |

## Validation

Joi schema validates all required variables on startup. Missing required variables cause the application to fail to start.

## TypeScript Configuration

| Setting | Value |
|---------|-------|
| Target | ES2021 |
| Module | CommonJS |
| Strict null checks | Enabled |
| Decorators | Experimental (required by NestJS) |
| Path aliases | `@features/*`, `@infrastructure/*`, `@presentation/*`, `@core/*` |
