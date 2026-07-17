# Database

This document describes the PostgreSQL and TypeORM implementation.

## Relevant Files

- [src/infrastructure/config/databases/postgres.config.ts](../src/infrastructure/config/databases/postgres.config.ts)
- [src/infrastructure/databases/postgres/postgres.module.ts](../src/infrastructure/databases/postgres/postgres.module.ts)
- [src/infrastructure/databases/postgres/data-source.ts](../src/infrastructure/databases/postgres/data-source.ts)
- [src/infrastructure/databases/postgres/migrations](../src/infrastructure/databases/postgres/migrations)
- [src/features/users/entities/user.entity.ts](../src/features/users/entities/user.entity.ts)
- [src/features/sessions/entities/session.entity.ts](../src/features/sessions/entities/session.entity.ts)

## Runtime Configuration

`postgres.config.ts` builds a PostgreSQL URL from environment variables:

```text
postgresql://{DATA_SOURCE_USERNAME}:{DATA_SOURCE_PASSWORD}@{DATA_SOURCE_HOST}:{DATA_SOURCE_PORT}/{DATA_SOURCE_DATABASE}
```

Runtime TypeORM options:

- `type: 'postgres'`
- `autoLoadEntities: true`
- `url: ...`

`PostgresModule` registers this through `TypeOrmModule.forRootAsync()`.

## Migration Data Source

[data-source.ts](../src/infrastructure/databases/postgres/data-source.ts) is used by TypeORM migration scripts. It:

- Loads `.env` with `dotenv` and `dotenv-expand`.
- Uses the same PostgreSQL config factory.
- Sets `synchronize: false`.
- Sets `migrationsRun: false`.
- Loads entities from `dist/features/**/*.entity{.ts,.js}`.
- Loads migrations from `dist/infrastructure/databases/postgres/migrations/*{.ts,.js}`.

Because migration scripts point at `dist`, run `pnpm run build` before local
migration commands. The production image already contains compiled output.

## Schema Overview

```mermaid
erDiagram
  USER ||--o{ SESSION : owns

  USER {
    uuid id PK
    varchar name
    varchar email UK
    varchar username UK
    varchar password
    enum status
    enum role
    timestamp createdAt
    timestamp updatedAt
    timestamp deleteAt
  }

  SESSION {
    uuid id PK
    varchar refreshTokenHash
    jsonb device
    varchar ipAddress
    boolean isRevoked
    timestamp expiresAt
    timestamp lastUsedAt
    integer version
    timestamp rotatedAt
    timestamp createdAt
    timestamp updatedAt
    uuid ownerId FK
  }
```

## User Table

Defined by [User entity](../src/features/users/entities/user.entity.ts) and migrations.

Important constraints:

- Primary key: `id` UUID.
- Unique constraint: `users_email_unique` on `email`.
- Unique constraint: `users_username_unique` on `username`.
- `status` enum values: `ACTIVATE`, `DEACTIVATE`, `SUSPEND`.
- `role` enum values: `ADMIN`, `USER`.
- Soft delete timestamp: `deleteAt`.

Default values:

- `status`: `DEACTIVATE`.
- `role`: `USER`.

## Session Table

Defined by [Session entity](../src/features/sessions/entities/session.entity.ts) and migrations.

Important fields:

- `refreshTokenHash`: current hashed refresh token.
- `device`: JSONB session device snapshot.
- `ipAddress`: login IP address.
- `isRevoked`: server-side revocation flag.
- `expiresAt`: active-session expiry.
- `lastUsedAt`: latest usage timestamp.
- `version`: optimistic concurrency field for refresh rotation.
- `rotatedAt`: latest refresh-token rotation timestamp.
- `ownerId`: foreign key to `user.id`.

The entity defines `ManyToOne(() => User, (user) => user.sessions, { nullable: false })`.

## Migrations

Existing migration files:

| Migration                                                  | Purpose                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `1767562475000-EnableUuidOsspExtension.ts`                 | Enables `uuid-ossp` before UUID defaults are created.                                  |
| `1767562475194-create-user-and-session-table.ts`           | Creates user/session tables and user enums.                                            |
| `1778584733796-AddSessionFields.ts`                        | Replaces initial token/device/IP/expiry columns with refresh/session lifecycle fields. |
| `1781203122645-RenameUserAgentToDevice.ts`                 | Renames/recreates session device column as JSONB.                                      |
| `1781430797078-AddRotatedAtFieldOnSessionEntity.ts`        | Adds `rotatedAt`.                                                                      |
| `1782233299217-AddVersionFieldToSessionEntity.ts`          | Adds `version` and index `IDX_session_id_version`.                                     |
| `1782300000000-AddSessionIndexes.ts`                       | Adds owner/activity and expiry indexes for session queries.                            |
| `1782400000000-DropRedundantSessionIdVersionIndex.ts`      | Removes the redundant session ID/version index.                                        |
| `1782500000000-CorrectSessionSchemaForProductionSafety.ts` | Backfills and constrains session fields after earlier unsafe schema changes.           |

Migration commands:

```bash
pnpm run build
pnpm run migration:create
pnpm run migration:generate
pnpm run migration:run
pnpm run migration:revert
pnpm run migration:show
```

Production migrations are not run by TypeORM application startup. Deployment
runs `npm run migration:run` once from the immutable production image before
starting application replicas. Production release jobs targeting the same
database must be serialized.

The first migration enables `uuid-ossp` before the schema uses
`uuid_generate_v4()`. The production migration role therefore needs permission
to create that extension on a fresh database.

## Repository Access Pattern

Services use `DataSource.getRepository()`:

- `UsersService.userRepo`
- `SessionsService.sessionRepo`

The modules import `TypeOrmModule.forFeature([User])` and `TypeOrmModule.forFeature([Session])`, but the services do not inject `Repository<T>` with `@InjectRepository()`.

## Current Database Gaps

- No pagination or filtering queries are implemented for admin user listing.
- No database-level checks were found for non-negative session version.
- TypeORM `synchronize` is not enabled in the migration data source, which is appropriate for migration-based schema management.
