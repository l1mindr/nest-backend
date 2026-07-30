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
| id | uuid | PK, default `gen_random_uuid()` |
| name | varchar(50) | Nullable, `select: false` |
| email | varchar | UK |
| username | varchar(30) | UK |
| password | varchar | `select: false` |
| status | enum | `PENDING_VERIFICATION` (default), `ACTIVATE`, `SUSPEND`, `DEACTIVATE` |
| role | enum | `USER` (default), `ADMIN` |
| createdAt | timestamptz | Auto-set |
| updatedAt | timestamptz | Auto-set |
| deleteAt | timestamptz | Nullable, soft delete |

#### Sessions Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| refreshTokenHash | varchar | SHA-256 |
| device | jsonb | Nullable |
| ipAddress | varchar | |
| isRevoked | boolean | Default false |
| expiresAt | timestamptz | |
| lastUsedAt | timestamptz | |
| version | integer | Optimistic concurrency |
| rotatedAt | timestamptz | |
| createdAt | timestamptz | Auto-set |
| updatedAt | timestamptz | Auto-set |
| ownerId | uuid | FK → User.id |

Indexes: `(ownerId, isRevoked, expiresAt)`, `expiresAt`

#### Verification Codes Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| userId | uuid | FK → User.id |
| codeHash | varchar | SHA-256 |
| expiresAt | timestamptz | 3 minutes |
| verifiedAt | timestamptz | Nullable |
| createdAt | timestamptz | Auto-set |

### Migrations

| # | Name | Description |
|---|------|-------------|
| 1 | `CreateUsersTable` | Initial user schema |
| 2 | `CreateSessionsTable` | Initial session schema |
| 3 | `CreateCoinAndPriceAlertTables` | Coin tracker entities |
| 4 | `CreateVerificationTable` | Email verification codes |
| 5–9 | Production corrections | Indexes, defaults, schema refinement |

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
