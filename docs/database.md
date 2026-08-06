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
| role | enum | `USER` (default), `ADMIN`, `OWNER` |
| createdAt | timestamp | Auto-set |
| updatedAt | timestamp | Auto-set |
| deleteAt | timestamp | Nullable, soft delete |

Partial unique index `uq_user_single_owner` on `role WHERE role = 'OWNER'`
enforces that at most one owner can ever exist, independently of any
application-level check.

#### Permission Table

Reference data, seeded by migration. Held back from the E2E truncation helper
so that the foreign keys pointing at it survive between specs.

| Column | Type | Constraints |
|--------|------|-------------|
| code | varchar(64) | PK |
| description | varchar(255) | Not null |

#### Admin Permission Table

One row per permission granted to one administrator.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default `uuid_generate_v4()` |
| userId | uuid | FK → `user(id)` ON DELETE CASCADE |
| permission | varchar(64) | FK → `permission(code)` ON DELETE RESTRICT |
| grantedById | uuid | Nullable, FK → `user(id)` ON DELETE SET NULL |
| grantedAt | timestamp | Auto-set |

Unique on `(userId, permission)`, indexed on `userId`. The foreign key to the
catalog means a grant can only ever name a permission the system knows about.

#### Admin Invitation Table

A pending offer of administrator status. No account exists until the invitation
is accepted, so a revoked or expired invitation leaves nothing that could be
signed into.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default `uuid_generate_v4()` |
| email | varchar | Indexed |
| tokenHash | varchar(64) | UK; SHA-256 of the issued token, `select: false` |
| permissions | varchar(64)[] | Delegable permission codes only |
| expiresAt | timestamp | 48 hours after issue |
| acceptedAt | timestamp | Nullable |
| revokedAt | timestamp | Nullable |
| invitedById | uuid | Nullable, FK → `user(id)` ON DELETE SET NULL |
| acceptedUserId | uuid | Nullable, FK → `user(id)` ON DELETE SET NULL |
| createdAt | timestamp | Auto-set |

Unique on `tokenHash`. A partial unique index on `(email) WHERE acceptedAt IS
NULL AND revokedAt IS NULL` allows at most one outstanding invitation per
address. Status is derived from the timestamps, not stored.

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
| 5 | `CreateVerificationCodeActiveLatestIndex` | Partial index for the latest active verification code lookup |
| 6 | `CreateAuthorizationTables` | Adds `OWNER` to the role enum, the single-owner index, and the permission and grant tables |
| 7 | `CreateAdminInvitationTable` | Adds `ADMIN_INVITE`/`ADMIN_DELETE`/`ADMIN_STATUS` to the catalog and the `admin_invitation` table |

## Redis

### Configuration

- Host: `REDIS_HOST` (default: localhost)
- Port: `REDIS_PORT` (default: 6379)
- Password: `REDIS_PASSWORD` (optional)
- DB: `REDIS_DB` (default: 0)

### Usage

| Concern | Service | Keys |
|---------|---------|------|
| Rate limiting | `RateLimitStoreService` | `rl:{prefix}:{identifier}:{hash}` |
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
