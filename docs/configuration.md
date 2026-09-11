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

### Cookies, CORS, and origins

| Variable | Default | Description | Secret |
|----------|---------|-------------|--------|
| `COOKIE_DOMAIN` | — (host-only) | Parent domain for auth cookies, e.g. `.example.com`. Unset leaves cookies host-only, which is correct on localhost and in Docker. Required when the frontend and API are on different subdomains. See [authentication.md](authentication.md) | No |
| `CORS_ORIGIN` | — | Allowed browser origin. Also applied to the Socket.IO adapter | No |
| `PUBLIC_API_URL` | — | Public base URL of the API, used where an absolute link is rendered | No |

### MongoDB

| Variable | Default | Description | Secret |
|----------|---------|-------------|--------|
| `MONGODB_URI` | — | Connection string for the log store | Yes, if it embeds credentials |
| `MONGODB_DATABASE` | — | Database name. `test/setup/worker-env.ts` derives one per Jest worker from this base | No |

### CoinGecko and market upstreams

| Variable | Default | Description | Secret |
|----------|---------|-------------|--------|
| `COINGECKO_BASE_URL` | — | CoinGecko API base | No |
| `COINGECKO_API_KEY` | — | CoinGecko API key | **Yes** |
| `COINGECKO_TIMEOUT_MS` | — | Per-request timeout | No |
| `COINGECKO_RETRIES` | — | Retry attempts | No |
| `COINGECKO_BACKOFF_MS` | — | Retry backoff | No |

### Queues

| Variable | Default | Description |
|----------|---------|-------------|
| `QUEUE_PREFIX` | `bull` | Namespaces every BullMQ key so deployments can share one Redis |
| `EMAIL_QUEUE_ATTEMPTS` | 5 | Delivery attempts |
| `EMAIL_QUEUE_BACKOFF_MS` | 5000 | Exponential backoff base |
| `EMAIL_QUEUE_KEEP_COMPLETED` | 100 | Completed jobs retained |
| `EMAIL_QUEUE_KEEP_FAILED` | 1000 | Failed jobs retained |
| `EMAIL_QUEUE_PUBLISH_TIMEOUT_MS` | 2000 | Ceiling on how long publishing may block a request |
| `ASSET_SYNC_INTERVAL` | 3600 | Asset price sync interval, **seconds** |
| `ASSET_SYNC_QUEUE_ATTEMPTS` | 4 | Sync attempts |
| `ASSET_SYNC_QUEUE_BACKOFF_MS` | 60000 | Sync backoff |
| `ASSET_SYNC_QUEUE_KEEP_COMPLETED` | 10 | Completed sync jobs retained |
| `ASSET_SYNC_QUEUE_KEEP_FAILED` | 50 | Failed sync jobs retained |
| `ASSET_SYNC_QUEUE_PUBLISH_TIMEOUT_MS` | 2000 | Publish ceiling |

See [email.md](email.md) and [portfolio-market.md](portfolio-market.md).

### Password hashing

| Variable | Description |
|----------|-------------|
| `BCRYPT_ROUNDS` | Cost factor. Lowered in `.env.test` to keep the suite fast |
| `ARGON2_MEMORY_COST` | Argon2 memory cost |
| `ARGON2_TIME_COST` | Argon2 time cost |
| `ARGON2_PARALLELISM` | Argon2 parallelism |
| `ARGON2_HASH_LENGTH` | Argon2 output length |

See [password-hashing.md](password-hashing.md).

### Read from the environment but **not** in the Joi schema

These are consumed via `process.env` with in-code defaults and are therefore not
validated at startup. A typo in one is silently ignored rather than reported:

| Variable | Default | Description |
|----------|---------|-------------|
| `MARKET_OVERVIEW_CACHE_TTL_MS` | 90000 | `/v1/market/overview` cache TTL |
| `BITCOIN_MARKET_CACHE_TTL_MS` | 30000 | `/v1/market/bitcoin` cache TTL |
| `COIN_TICKER_CACHE_TTL_MS` | 30000 | Coin ticker cache TTL |
| `FEAR_GREED_CACHE_TTL_MS` | — | `/v1/market/fear-greed` cache TTL |
| `FEAR_GREED_BASE_URL` | — | Alternative.me API base |

The USDT/Toman variables are **not** in that list — they are validated at
startup, so a typo fails the boot instead of being ignored:

| Variable | Default | Description |
|----------|---------|-------------|
| `USDT_TOMAN_PROVIDER` | `nobitex` | Preferred exchange: `nobitex` or `wallex`. Any other value fails startup. The unchosen one is the automatic fallback. |
| `USDT_TOMAN_CACHE_TTL_MS` | 60000 | `/v1/market/usdt-toman` cache TTL, shared by both exchanges |
| `RIAL_PER_TOMAN` | 10 | Rial per Toman, for venues quoting Rial |
| `NOBITEX_BASE_URL` | `https://apiv2.nobitex.ir` | Nobitex API base (https). Note `api.nobitex.ir` does **not** resolve. |
| `NOBITEX_TIMEOUT_MS` | 10000 | Per-request timeout (1000–60000) |
| `NOBITEX_RETRIES` | 2 | Retries for transient failures (0–5) |
| `NOBITEX_BACKOFF_MS` | 1000 | Exponential base delay between retries |
| `WALLEX_BASE_URL` | `https://api.wallex.ir` | Wallex API base (https) |
| `WALLEX_TIMEOUT_MS` | 10000 | Per-request timeout (1000–60000) |
| `WALLEX_RETRIES` | 2 | Retries for transient failures (0–5) |
| `WALLEX_BACKOFF_MS` | 1000 | Exponential base delay between retries |

See [usdt-toman.md](usdt-toman.md) for units, fallback order and observability.

`E2E_MAX_WORKERS` is likewise absent from the schema, and correctly so: it
configures the Jest runner, not the application. See [testing.md](testing.md).

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

Registered with `registerAs`:

| Namespace | Variables | Usage |
|-----------|-----------|-------|
| `database` | host, port, username, password, database, pool size, timeouts | TypeORM data source |
| `redis` | host, port, password, db | ioredis client |
| `mongodb` | uri, database | Mongoose connection for system/audit logs |
| `jwt` | accessSecret, refreshSecret | TokenIssueService, JwtStrategy |
| `csrf` | secret | CsrfTokenService |
| `security` | hash secret | Device identifiers, rate-limit key HMAC |
| `email` | appName, host, port, secure, user, appPassword, from | SMTP transport (Nodemailer) |
| `queue` | prefix, email.*, assetSync.* | BullMQ job options |
| `coingecko` | baseUrl, apiKey, timeout, retries, backoff | Asset sync + coin tracker |
| `coingeckoGlobal` | baseUrl, cache TTLs | Market overview / coin tickers |
| `usdtToman` | preferred provider, cache TTL | USDT/Toman provider selection |
| `nobitexUsdtToman` | baseUrl, timeout, retries, backoff, rialPerToman | USDT/Toman rate (Nobitex) |
| `wallexUsdtToman` | baseUrl, timeout, retries, backoff | USDT/Toman rate (Wallex) |
| `fearGreed` | baseUrl, cache TTL | Fear & Greed index |

There is **no `app` namespace and no `PORT` variable**. The HTTP port is
hardcoded as `8080` in `src/main.ts`; remap it at the container or proxy layer
rather than by environment.

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
