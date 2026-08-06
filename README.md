# Nest Backend

NestJS API for user authentication, session management, account administration, and cryptocurrency price tracking. Uses PostgreSQL (TypeORM), Redis (ioredis), cookie-based JWT authentication, server-side sessions, CSRF protection, permission-based access control with a three-tier role hierarchy, and Jest/Supertest tests.

The package metadata currently sets `"private": true` and `"license": "UNLICENSED"`. Update those fields before publishing this repository as an open-source package.

## Architecture

The codebase is organized into four layers under `src/`:

| Layer             | Responsibility                                      |
|-------------------|-----------------------------------------------------|
| `core/`           | Framework-agnostic shared logic, value objects      |
| `infrastructure/` | External adapters — databases, config, env, caching |
| `features/`       | Business feature modules with full vertical slices  |
| `presentation/`   | Shared HTTP concerns — interceptors, DTOs, pipes    |

Each feature module (auth, users, sessions, coin-tracker) follows a vertical slice layout:

- `domain/` — entities, enums, errors
- `application/` — use cases, mappers, service interfaces
- `infrastructure/` — repository implementations
- `presentation/` — controllers, DTOs, swagger, decorators

## Features

| Module         | Capabilities                                                                       |
|----------------|------------------------------------------------------------------------------------|
| **Auth**       | Register (email verification required), login, refresh tokens, change password; rate-limited public endpoints |
| **Users**      | Profile retrieval/update, account deletion, admin user management (CRUD, suspend/unsuspend) |
| **Authorization** | Hierarchical roles (OWNER/ADMIN/USER), granular permissions, administrator management, permission grants |
| **Sessions**   | List active sessions, revoke current session, terminate other sessions              |
| **Coin Tracker** | List/search supported coins, create/list/update/cancel price alerts              |
| **Security**   | JWT guard, role and permission guards, CSRF protection, device detection, rate limiting |

## Documentation

The detailed project documentation lives in [docs](docs/). It is based on the current source code, configuration, tests, and Docker files.

| Document                                       | Purpose                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| [Architecture](docs/architecture.md)           | System layers, module graph, runtime setup, and architectural gaps.          |
| [Project Structure](docs/project-structure.md) | Repository layout and source organization.                                   |
| [Modules](docs/modules.md)                     | Nest modules, providers, imports, exports, and module communication.         |
| [Authentication](docs/authentication.md)       | Registration, login, refresh, password change, tokens, and cookies.          |
| [Authorization](docs/authorization.md)         | Role hierarchy, permission model, guards, owner invariants, permission matrix. |
| [Sessions](docs/sessions.md)                   | Session entity, session endpoints, revocation, and refresh rotation.         |
| [Security](docs/security.md)                   | Implemented controls and current security gaps.                              |
| [API](docs/api.md)                             | Routes, request DTOs, response envelopes, Swagger, and validation rules.     |
| [Database](docs/database.md)                   | PostgreSQL config, TypeORM data source, migrations, and schema.              |
| [Entities](docs/entities.md)                   | User/session entities, embedded timestamps, DTOs, and serialization.         |
| [Caching](docs/caching.md)                     | Redis usage, rate-limit counters, and refresh-flow key helper.               |
| [Configuration](docs/configuration.md)         | Environment variables, config modules, TypeScript, and package manager notes.|
| [Testing](docs/testing.md)                     | Unit tests, e2e tests, helpers, factories, Dockerized test flow, and CI.     |
| [Deployment](docs/deployment.md)               | Production image, migration release job, Compose flow, rollback, and CI.     |
| [Development Guide](docs/development-guide.md) | Local setup, migrations, tests, code quality, and hooks.                     |
| [Coding Decisions](docs/coding-decisions.md)   | Implementation decisions visible in the codebase.                            |
| [Dependencies](docs/dependencies.md)           | Runtime/dev dependency groups and automation.                                |
| [Request Lifecycle](docs/request-lifecycle.md) | Request flow from middleware through guards, pipes, services, and filters.   |
| [Diagrams](docs/diagrams.md)                   | Mermaid diagrams for modules, auth, refresh, entities, and lifecycle.        |
| [Glossary](docs/glossary.md)                   | Project terms and definitions.                                               |

Compodoc auto-generated documentation is also available:

```bash
pnpm run docs
```

Compodoc serves a web UI at `http://localhost:3333` with coverage, dependency graphs, and module documentation.

## API Endpoints

All routes are URI-versioned under `/v1`.

### Auth (`/v1/auth`)

Rate limits apply across several identifiers at once; all must pass. See
[docs/security.md](docs/security.md#rate-limiting).

| Method | Path             | Auth     | Rate Limit (per dimension) | Description                |
|--------|------------------|----------|----------------------------|----------------------------|
| POST   | `/auth/register` | Public   | ip 5/60s · device 10/60s   | Register a new user account |
| POST   | `/auth/verify-email` | Public | ip 10/60s · device 10/60s · email 5/10m · code 20/10m | Verify email with a 6-digit code |
| POST   | `/auth/resend-verification` | Public | ip 5/60s · device 10/60s · email 10/1h | Resend code (60s cooldown, 5/hour) |
| POST   | `/auth/login`    | Public   | ip 5/60s · email 10/15m · device 10/60s | Login with email/username + password |
| POST   | `/auth/refresh`  | Public   | ip 20/60s · device 20/60s  | Refresh access token via cookie |
| POST   | `/auth/change-password` | Session | ip 3/5m · user 3/5m  | Change account password    |

### User (`/v1/user`)

| Method | Path                      | Auth    | Description                         |
|--------|---------------------------|---------|-------------------------------------|
| GET    | `/user/me`                | Session | Get current user profile            |
| PUT    | `/user`                   | Session | Update profile name                 |
| DELETE | `/user/delete-account`    | Session | Request account deletion            |

### Sessions (`/v1/sessions`)

| Method | Path                     | Auth    | Description                       |
|--------|--------------------------|---------|-----------------------------------|
| GET    | `/sessions`              | Session | List active sessions (cursor paginated) |
| DELETE | `/sessions`              | Session | Revoke current session (sign out) |
| DELETE | `/sessions/others`       | Session | Terminate all other sessions      |

### Admin Users (`/v1/admin/users`)

Each route requires a permission rather than a role. Holding `ADMIN` grants
nothing on its own; the owner satisfies every requirement without evaluation.

This is the *ordinary user* population only: administrators and the owner are a
separate population reached through `/v1/admin/administrators`, so they never
appear in user listings and can never be addressed through these routes.

| Method | Path                         | Requires          | Description                           |
|--------|------------------------------|-------------------|---------------------------------------|
| GET    | `/admin/users`               | `USER_READ`       | List users (cursor paginated)         |
| GET    | `/admin/users/:id`           | `USER_READ`       | Get single user by ID                 |
| POST   | `/admin/users/:id/suspend`   | `USER_SUSPEND`    | Suspend a user (requires reason)      |
| PATCH  | `/admin/users/:id/unsuspend` | `USER_UNSUSPEND`  | Unsuspend a previously suspended user |

### Administrators (`/v1/admin/administrators`)

Administrator management is **owner-only**: every route declares a permission
that is reserved to the owner in the catalog, so no administrator can ever be
granted access to it. Relaxing this later is one flag per permission in the
catalog — no controller rewrite.

Administrators are created by **invitation**, never by promoting an existing
account. The owner issues an invitation; no account exists until the invitee
accepts it by choosing a username and password.

| Method | Path                                         | Requires           | Description                                  |
|--------|----------------------------------------------|--------------------|----------------------------------------------|
| GET    | `/admin/administrators`                      | `ADMIN_READ`       | List administrators and their grants         |
| GET    | `/admin/administrators/:id`                  | `ADMIN_READ`       | Get one administrator                        |
| GET    | `/admin/administrators/me`                   | Session            | The caller's own administrator profile       |
| PATCH  | `/admin/administrators/:id`                  | `ADMIN_UPDATE`     | Edit an administrator's profile              |
| DELETE | `/admin/administrators/:id`                  | `ADMIN_DELETE`     | Delete an administrator account              |
| POST   | `/admin/administrators/:id/activate`         | `ADMIN_STATUS`     | Restore a deactivated administrator          |
| POST   | `/admin/administrators/:id/deactivate`       | `ADMIN_STATUS`     | Switch off access, revoke sessions           |
| POST   | `/admin/administrators/:id/suspend`          | `ADMIN_STATUS`     | Suspend an administrator                     |
| PATCH  | `/admin/administrators/:id/unsuspend`        | `ADMIN_STATUS`     | Lift the suspension                          |
| POST   | `/admin/administrators/:id/permissions`      | `ROLE_ASSIGN`      | Grant permissions                            |
| DELETE | `/admin/administrators/:id/permissions`      | `ROLE_ASSIGN`      | Revoke permissions                           |

### Administrator invitations (`/v1/admin/administrators/invitations`)

| Method | Path         | Requires     | Description                                              |
|--------|--------------|--------------|----------------------------------------------------------|
| POST   | `/invitations` | `ADMIN_INVITE` | Invite an address to become an administrator           |
| GET    | `/invitations` | `ADMIN_INVITE` | List the invitation log, including settled ones        |
| DELETE | `/invitations/:id` | `ADMIN_INVITE` | Revoke a pending invitation                          |
| POST   | `/invitations/accept` | Public    | Accept an invitation: creates the account (token = proof) |

Invitation tokens are single-use, expire after 48 hours, are revocable, and are
stored only as SHA-256 digests — a database dump yields nothing that could be
presented.

### Permissions (`/v1/admin/permissions`)

| Method | Path              | Requires    | Description                                      |
|--------|-------------------|-------------|--------------------------------------------------|
| GET    | `/permissions`    | `ADMIN_READ`| The permission catalog                            |
| GET    | `/permissions/me` | Session     | What the caller can do right now                  |

The owner is excluded from every listing: it never appears in user management,
in the administrator directory, in search or in statistics, and an identifier
harvested elsewhere resolves to the same "not found" as one that was never
issued. See [Authorization](docs/authorization.md) for the full permission
matrix and visibility rules.

### Coins (`/v1/coins`)

| Method | Path        | Auth    | Description                             |
|--------|-------------|---------|-----------------------------------------|
| GET    | `/coins`    | Session | Search and list supported cryptocurrencies (cursor paginated) |

### Price Alerts (`/v1/price-alerts`)

| Method | Path                 | Auth    | Description                           |
|--------|----------------------|---------|---------------------------------------|
| POST   | `/price-alerts`      | Session | Create a new price alert              |
| GET    | `/price-alerts`      | Session | List user's price alerts (cursor paginated with filters) |
| PATCH  | `/price-alerts/:id`  | Session | Update a price alert                  |
| DELETE | `/price-alerts/:id`  | Session | Cancel a price alert                  |

## Response Format

- Successful responses are wrapped in a `{ data: ... }` envelope by `DataResponseInterceptor`; 204 No Content responses return an empty body.
- Paginated endpoints return `{ data: { items: [...], nextCursor: string | null } }` (session lists also include `currentSession`).
- Error responses follow `{ error: { code, domain, message, meta, path, timestamp } }`.

## Swagger UI

Available in development mode at:

```
http://localhost:8080/api
```

## Quick Start

Prerequisites:

- Node.js 22
- Corepack and pnpm 11
- PostgreSQL
- Redis

Install dependencies:

```bash
corepack enable
pnpm install --frozen-lockfile
```

Create an environment file:

```bash
cp .env.example .env
```

Set real values for PostgreSQL, Redis, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `CSRF_TOKEN_SECRET`, `NODE_ENV`, and the `EMAIL_*` variables (see `.env.example` for a Gmail SMTP template).

Run in development:

```bash
pnpm run start:dev
```

The application listens on:

```
http://localhost:8080
```

## Environment Variables

| Variable                        | Required | Default  | Description                              |
|---------------------------------|----------|----------|------------------------------------------|
| `NODE_ENV`                      | Yes      | —        | One of: development, production, test, staging |
| `DATA_SOURCE_USERNAME`          | Yes      | —        | PostgreSQL user                          |
| `DATA_SOURCE_PASSWORD`          | Yes      | —        | PostgreSQL password                      |
| `DATA_SOURCE_HOST`              | Yes      | —        | PostgreSQL hostname or IP                |
| `DATA_SOURCE_PORT`              | Yes      | —        | PostgreSQL port (1–65535)                |
| `DATA_SOURCE_DATABASE`          | Yes      | —        | PostgreSQL database name                 |
| `DATA_SOURCE_POOL_SIZE`         | No       | 10       | Connection pool size (1–100)             |
| `DATA_SOURCE_CONNECT_TIMEOUT_MS`| No       | 5000     | Connection timeout in ms (1000–60000)    |
| `DATA_SOURCE_IDLE_TIMEOUT_MS`   | No       | 30000    | Idle timeout in ms (1000–600000)         |
| `REDIS_HOST`                    | Yes      | —        | Redis hostname or IP                     |
| `REDIS_PORT`                    | Yes      | —        | Redis port (1–65535)                     |
| `REDIS_PASSWORD`                | Prod     | —        | Redis password (required in production, entropy-validated) |
| `REDIS_DB`                      | No       | 0        | Redis database index                     |
| `MAX_ACTIVE_SESSIONS`           | Yes      | —        | Maximum concurrent sessions per user     |
| `LOG_LEVEL`                     | No       | debug    | One of: info, debug, warn, error, silent |
| `E2E_LOGS`                      | No       | false    | Enable request/response logging in e2e   |
| `ACCESS_TOKEN_SECRET`           | Yes      | —        | JWT access token signing secret (entropy-validated) |
| `REFRESH_TOKEN_SECRET`          | Yes      | —        | JWT refresh token signing secret (must differ from access) |
| `CSRF_TOKEN_SECRET`             | Yes      | —        | CSRF token secret (must differ from both JWT secrets) |
| `APP_NAME`                      | No       | NestJS Backend | Sender display name in transactional emails |
| `EMAIL_HOST`                    | Yes      | —        | SMTP hostname or IP (e.g. `smtp.gmail.com`) |
| `EMAIL_PORT`                    | No       | 587      | SMTP port (1–65535) |
| `EMAIL_SECURE`                  | No       | false    | Use TLS when connecting to the SMTP server |
| `EMAIL_USER`                    | Yes      | —        | SMTP account username |
| `EMAIL_APP_PASSWORD`            | Yes      | —        | SMTP app password (min 16 chars in production) |
| `EMAIL_FROM`                    | Yes      | —        | Sender address used in outgoing emails |

In production, secrets undergo entropy validation and additional cross-field safety checks (e.g. Redis must not use localhost, DB password must not match a token secret).

## Common Commands

```bash
pnpm run build                 # Compile the project
pnpm run start                 # Production start via nest
pnpm run start:dev             # Watch mode development
pnpm run start:prod            # Production start from dist/
pnpm run format                # Format with Prettier
pnpm run lint                  # Lint with ESLint
pnpm run typecheck             # TypeScript type checking (no emit)
pnpm run test:unit             # Run unit tests
pnpm run test:e2e              # Run end-to-end tests
pnpm run test:cov              # Run tests with coverage
pnpm run migration:create      # Create a blank migration
pnpm run migration:generate    # Generate migration from entity changes
pnpm run migration:run         # Apply pending migrations
pnpm run migration:revert      # Revert last migration
pnpm run migration:show        # Show migration status
pnpm run docs                  # Compodoc documentation server
pnpm run generate:secrets      # Generate secure random secrets
```

## Notes

- Routes are URI-versioned under `/v1`.
- The app port is hardcoded to `8080`.
- Production deployments run migrations as a one-shot release job before starting application replicas. See [Deployment](docs/deployment.md).
- Secrets are validated for entropy to prevent weak keys in production.
- End-to-end tests run against a dedicated test database and Redis instance.
