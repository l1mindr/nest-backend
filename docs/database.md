# Database Design

This document describes database design and operational decisions for the project: how we use TypeORM, migration practices, soft-delete strategy, indexing guidance, and the `session.version` column design used for safe refresh rotation.

---

## TypeORM Usage

- DataSource: the project uses a single Postgres `DataSource` configured under `infrastructure/databases/postgres` with environment-aware connection options.
- Entities: map domain models to TypeORM `@Entity()` classes. Keep entities focused on persistence concerns only; complex domain logic belongs in `features/*` services.
- Repositories: prefer TypeORM `Repository<T>` or `DataSource.getRepository()` for simple CRUD. For complex queries, use `QueryBuilder` and explicit SQL when necessary for performance.
- Transactions: use `manager.transaction(...)` for multi-step updates that must be atomic. Keep transactions short to reduce lock contention.
- Build-time vs runtime: migrations and runtime data source code live in `src/infrastructure/databases/postgres`. The `package.json` migration scripts run compiled JS under `dist/` (see `migration:generate`, `migration:run`).

Best practices:
- Keep entity columns explicit (non-nullable where possible) and document assumptions in entity JSDoc.
- Avoid `synchronize: true` in production — use migrations instead.

---

## Migrations Strategy

Goals:
- Reliable, auditable schema changes
- Repeatable execution across environments
- Safe incremental rollouts and rollbacks where supported

Practices:
- Use TypeORM migrations (CLI or programmatic) to generate schema changes: `yarn typeorm migration:generate` and `yarn typeorm migration:run` as reflected in `package.json` scripts.
- Migration files live in `prisma` or `migrations` folder as configured; follow the existing project convention under `infrastructure/databases/postgres/migrations`.
- Always review generated SQL from `migration:generate` before committing.
- Migration flow:
  1. Branch + develop changes locally.
  2. `yarn build` then `yarn migration:generate -n descriptive_name` to create migration under `dist` mapping.
  3. Commit migration file with code changes.
  4. In CI/Deploy, run `yarn migration:run` during deployment (before application start) with DB backups in place.
- Rollback: `migration:revert` can be used in development; in production, prefer forward-only migrations or careful rollback plans.

Operational notes:
- Run migrations with a lock or single-run deploy step to avoid multiple instances running migrations concurrently.
- Have a rollback strategy (backups, reversible migrations) for destructive changes.

---

## Soft Delete System

Options:
1. TypeORM `softRemove()` / `@DeleteDateColumn()` — built-in soft delete where soft-deleted rows get a `deletedAt` timestamp and queries can exclude them by default if using repository helpers.
2. Manual boolean flag (`is_deleted`) + `deleted_at` timestamp — more explicit and can support partial indexes and custom semantics.

Recommendation:
- Use explicit `deleted_at` timestamp column (e.g., `deleted_at TIMESTAMP WITH TIME ZONE NULL`) and a companion boolean `is_deleted` only if you need fast boolean checks; otherwise `deleted_at` is sufficient.
- Add a `@Index` on `deleted_at` if you query non-deleted rows frequently.
- Implement a repository-level helper or a TypeORM global scope (via custom repository or QueryBuilder wrapper) that excludes rows where `deleted_at IS NOT NULL` by default.

Example entity snippet (TypeORM):

```ts
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  deletedAt?: Date | null;
}
```

Cleanup & archival:
- Periodically archive or purge old soft-deleted rows if retention is required.

---

## Indexing Strategy

Goals:
- Speed up common queries (authentication lookups, session lookups, list endpoints)
- Keep write amplification reasonable
- Avoid over-indexing which increases storage and slows writes

Recommendations:
- Index columns used in `WHERE` clauses and joins.
- Use unique indexes for constrained columns (`email` unique index).
- Add composite indexes for common multi-column queries (e.g., `(user_id, created_at)` for recent user activity queries).
- Partial indexes for soft-delete: index only non-deleted rows to speed reads and reduce index size. Example:

```sql
CREATE INDEX idx_users_email_active ON users (email) WHERE deleted_at IS NULL;
```

- Index for sessions: include `(id)` primary key, and index `(user_id)` for queries listing sessions per user.
- For the `sessions.version` concurrency check, add an index on `id` (PK) and consider an index on `(user_id, revoked_at)` for session listing and revocation queries.

Monitoring:
- Use `pg_stat_statements` and slow-query logs to identify missing indexes.
- Track index usage and drop unused indexes periodically.

---

## `session.version` Column Design

Purpose:
- Provide an optimistic concurrency control field used during refresh token rotation (see `docs/sessions.md`).

Design:
- Column type: `integer` (or `bigint` if you expect extremely frequent rotations). Default `0`.
- Usage: incremented on each successful refresh rotation.
- Constraints:
  - Non-nullable with default `0`.
  - Consider a check constraint to keep it non-negative.
- Storage: keep `refresh_hash` (hashed current token) and optionally `previous_refresh_hash` to enable reuse detection.

Example TypeORM entity snippet:

```ts
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'integer', default: 0 })
  version: number;

  @Column({ type: 'text', nullable: true })
  refreshHash?: string | null;

  @Column({ type: 'text', nullable: true })
  previousRefreshHash?: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revokedAt?: Date | null;
}
```

Atomic update pattern (SQL):

```sql
UPDATE sessions
SET refresh_hash = :new_hash,
    previous_refresh_hash = :old_hash,
    version = :new_version,
    last_activity_at = now()
WHERE id = :session_id
  AND version = :expected_version
  AND revoked_at IS NULL;
```

- This conditional update guarantees a single successful rotation from `expected_version` to `new_version`.
- Ensure this statement is executed within a transaction if other tables need updating concurrently.

---

## Operational Recommendations

- Backup database before major migrations.
- Run migrations in a single, controlled deployment step; avoid concurrent migrators.
- Add observability around slow queries and migration failures.
- Use connection pooling and configure reasonable pool sizes for TypeORM/pg to avoid connection storms.

---

## Example Migration Snippets

Create sessions table (simplified):

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  refresh_hash TEXT,
  previous_refresh_hash TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_activity_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_user_active ON sessions (user_id) WHERE revoked_at IS NULL;
```

Add partial index on users.email for active users:

```sql
CREATE UNIQUE INDEX ux_users_email_active ON users (lower(email)) WHERE deleted_at IS NULL;
```

---

## Summary

- Use TypeORM with explicit migrations and `DataSource` configuration for production safety.
- Prefer explicit `deleted_at` soft-delete semantics and repository defaults to exclude deleted rows.
- Index thoughtfully with partial indexes for non-deleted rows, composite indexes for common queries, and monitor usage.
- Implement `session.version` as an integer optimistic-concurrency field and perform conditional atomic updates during token rotation to avoid races.

---

Next steps:
- Create a TypeORM entity interface files and migration templates under `infrastructure/databases/postgres` if you want me to scaffold them.
