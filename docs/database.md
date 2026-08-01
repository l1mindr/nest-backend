# Database

## PostgreSQL

### Runtime Configuration

TypeORM configured via `TypeOrmModule.forRootAsync()` in `PostgresModule`:

- `autoLoadEntities: true` — entities discovered from imported TypeOrmModule.forFeature()
- Connection URL built from env vars (`DATA_SOURCE_*`)
- Pool size, connect timeout configured via `postgresConfig`

### Migration Data Source

File: `src/infrastructure/databases/postgres/data-source.ts`

- Uses `dotenv` for env loading (separate from NestJS ConfigModule)
- `synchronize: false`, `migrationsRun: false`
- Loads entities from `dist/features/**/*.entity{.ts,.js}`
- Loads migrations from `dist/infrastructure/databases/postgres/migrations/*`

### Schema

#### Users Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default `uuid_generate_v4()` |
| name | varchar(50) | Nullable, `select: false` |
| email | varchar | UK |
| username | varchar(30) | UK |
| password | varchar | `select: false` |
| status | enum | `PENDING_VERIFICATION` (default), `ACTIVATE`, `SUSPEND`, `DEACTIVATE` |
| role | enum | `USER` (default), `ADMIN` |
| createdAt | timestamp | Auto-set |
| updatedAt | timestamp | Auto-set |
| deleteAt | timestamp | Nullable, soft delete |

#### Sessions Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| refreshTokenHash | varchar | SHA-256 |
| device | jsonb | NOT NULL |
| ipAddress | varchar | |
| isRevoked | boolean | Default false |
| expiresAt | timestamp | |
| lastUsedAt | timestamp | |
| version | integer | Optimistic concurrency |
| rotatedAt | timestamp | Nullable |
| createdAt | timestamp | Auto-set |
| updatedAt | timestamp | Auto-set |
| ownerId | uuid | FK → User.id |

Indexes: `(ownerId, isRevoked, expiresAt)`, `(ownerId, isRevoked, expiresAt, createdAt)`, `expiresAt`

#### Verification Codes Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| userId | uuid | FK → User.id (CASCADE) |
| codeHash | varchar | bcrypt hash |
| expiresAt | timestamp with time zone | 3 minutes |
| verifiedAt | timestamp with time zone | Nullable |
| createdAt | timestamp | Auto-set |

#### Coins Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | varchar | PK (CoinGecko id) |
| symbol | varchar | |
| name | varchar | |
| image | varchar | Nullable |
| isActive | boolean | Default true |
| lastSyncedAt | timestamp | |
| createdAt | timestamp | Auto-set |
| updatedAt | timestamp | Auto-set |

#### Price Alerts Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default `uuid_generate_v4()` |
| userId | uuid | FK → User.id |
| coinId | varchar | FK → Coin.id |
| direction | enum | `BUY`, `SELL` |
| targetPrice | decimal | CHECK > 0 |
| triggerMode | enum | `ONCE` (default), `REPEAT` |
| status | enum | `ACTIVE` (default), `TRIGGERED`, `EXPIRED`, `CANCELLED` |
| expiresAt | timestamp | Nullable |
| notificationChannels | enum[] | `EMAIL`, `SMS`; CHECK non-empty |
| notificationCooldownMinutes | integer | Default 60, CHECK > 0 |
| lastCheckedPrice | decimal | Nullable |
| lastTriggeredAt | timestamp | Nullable |
| triggeredCount | integer | Default 0 |
| createdAt | timestamp | Auto-set |
| updatedAt | timestamp | Auto-set |

Indexes: `userId`, `status`, `coinId`, `(userId, status)`, `(status, coinId)`, `expiresAt`

### Migrations

| # | Name | Description |
|---|------|-------------|
| 1 | `CreateUsersTable` | Initial user schema |
| 2 | `CreateSessionsTable` | Initial session schema |
| 3 | `CreateCoinAndPriceAlertTables` | Coin tracker entities |
| 4 | `CreateVerificationTable` | Adds `PENDING_VERIFICATION` status and email verification codes |

## Redis

### Configuration

- Host: `REDIS_HOST` (default: localhost)
- Port: `REDIS_PORT` (default: 6379)
- Password: `REDIS_PASSWORD` (optional)
- DB: `REDIS_DB` (default: 0)

### Usage

| Concern | Service | Keys |
|---------|---------|------|
| Rate limiting | `RedisCounterService` | `rate:limit:{route}:{ip}` |
| Refresh lock | `RedisLockService` | `refresh:lock:{sessionId}` |
| Values | `RedisService` | General get/set/del |

### Lua Scripts

- Atomic counter increment with TTL (rate limiting)
- Compare-and-delete (lock release)
- Conditional set if not exists (lock acquire)

## Migration Workflow

```bash
# Build first
pnpm run build

# Run pending migrations
pnpm run migration:run

# Generate migration from entity changes
pnpm run migration:generate src/infrastructure/databases/postgres/migrations/MigrationName

# Revert last migration
pnpm run migration:revert
```
