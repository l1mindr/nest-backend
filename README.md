# Nest Backend v1

Nest Backend is a NestJS API for user authentication, session management, and account administration. It uses PostgreSQL with TypeORM, Redis with `ioredis`, cookie-based JWT authentication, server-side sessions, CSRF protection, role-based access control, and Jest/Supertest tests.

The package metadata currently sets `"private": true` and `"license": "UNLICENSED"`. Update those fields before publishing this repository as an open-source package.

## Documentation

The detailed project documentation lives in [docs](docs/). It is based on the current source code, configuration, tests, and Docker files.

| Document                                       | Purpose                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| [Architecture](docs/architecture.md)           | System layers, module graph, runtime setup, and architectural gaps.           |
| [Project Structure](docs/project-structure.md) | Repository layout and source organization.                                    |
| [Modules](docs/modules.md)                     | Nest modules, providers, imports, exports, and module communication.          |
| [Authentication](docs/authentication.md)       | Registration, login, refresh, password change, tokens, and cookies.           |
| [Authorization](docs/authorization.md)         | Global JWT guard, role guard, decorators, and admin access.                   |
| [Sessions](docs/sessions.md)                   | Session entity, session endpoints, revocation, and refresh rotation.          |
| [Security](docs/security.md)                   | Implemented controls and current security gaps.                               |
| [API](docs/api.md)                             | Routes, request DTOs, response envelopes, Swagger, and validation rules.      |
| [Database](docs/database.md)                   | PostgreSQL config, TypeORM data source, migrations, and schema.               |
| [Entities](docs/entities.md)                   | User/session entities, embedded timestamps, DTOs, and serialization.          |
| [Caching](docs/caching.md)                     | Redis usage, rate-limit counters, and refresh-flow key helper.                |
| [Configuration](docs/configuration.md)         | Environment variables, config modules, TypeScript, and package manager notes. |
| [Testing](docs/testing.md)                     | Unit tests, e2e tests, helpers, factories, Dockerized test flow, and CI.      |
| [Deployment](docs/deployment.md)               | Production image, migration release job, Compose flow, rollback, and CI.      |
| [Development Guide](docs/development-guide.md) | Local setup, migrations, tests, code quality, and hooks.                      |
| [Coding Decisions](docs/coding-decisions.md)   | Implementation decisions visible in the codebase.                             |
| [Dependencies](docs/dependencies.md)           | Runtime/dev dependency groups and automation.                                 |
| [Request Lifecycle](docs/request-lifecycle.md) | Request flow from middleware through guards, pipes, services, and filters.    |
| [Diagrams](docs/diagrams.md)                   | Mermaid diagrams for modules, auth, refresh, entities, and lifecycle.         |
| [Glossary](docs/glossary.md)                   | Project terms and definitions.                                                |

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

Set real values for PostgreSQL, Redis, `JWT_SECRET_KEY`, and a single `NODE_ENV` value.

Run in development:

```bash
pnpm run start:dev
```

The application listens on:

```text
http://localhost:8080
```

Swagger UI is available in development mode:

```text
http://localhost:8080/api
```

## Common Commands

```bash
pnpm run build
pnpm run start:prod
pnpm run test:unit
pnpm run test:e2e
pnpm run lint
pnpm run format
pnpm run migration:run
pnpm run docs
```

## Notes

- Successful API responses are wrapped as `{ "data": ... }`.
- Runtime errors are wrapped as `{ "error": ... }`.
- Routes are URI-versioned under `/v1`.
- The app port is hardcoded to `8080`.
- Production deployments run migrations as a one-shot release job before starting application replicas. See [Deployment](docs/deployment.md).
