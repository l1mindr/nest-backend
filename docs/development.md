# Developer Setup & Workflow

This guide describes how to set up a development environment, run the project locally, run migrations, and access API documentation (Swagger/Compodoc).

---

## Prerequisites

- Node.js (LTS recommended, e.g., v18+)
- Yarn 1 or Yarn 3 (the project `package.json` uses `yarn` as package manager)
- PostgreSQL (dev or local container)
- Redis (for features that use it)
- Git
- Optional: Docker / docker-compose for running Postgres/Redis locally

---

## Clone & Install

1. Clone the repository:

```bash
git clone <repo-url>
cd nest-backend
```

2. Install dependencies:

```bash
yarn install
```

3. Create an `.env` file (copy from example if present) and set required environment variables. Typical variables:

- `DATABASE_URL` or `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`
- `REDIS_URL`
- `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` (or symmetric `JWT_SECRET`)
- `NODE_ENV` (development/test)
- Any other app-specific config found in `src/infrastructure/config` or `env` files

---

## Run dependencies with Docker (optional)

Use `docker-compose` or individual containers for Postgres and Redis. Example (quick):

```bash
# start Postgres and Redis using docker-compose (example file not included)
docker-compose up -d
```

Or run testcontainers or local services as you prefer.

---

## Build & Run (development)

Start dev server with watch mode:

```bash
# development with automatic restart
yarn start:dev
```

Build and run production mode (local):

```bash
# build
yarn build
# run compiled dist
yarn start:prod
```

Debug mode (attach debugger):

```bash
yarn start:debug
```

Notes:
- `start:dev` uses `nest start --watch` and is the recommended workflow for iterative development.
- Ensure the database and redis are reachable from your environment.

---

## Run Migrations

Generate a migration (after building the project):

```bash
# compile first
yarn build
# generate migration with TypeORM (name required)
yarn migration:generate -n descriptive_migration_name
```

Run migrations:

```bash
# run migrations against configured DataSource
yarn migration:run
```

Revert last migration (development only):

```bash
yarn migration:revert
```

Notes:
- Always review generated migration SQL before committing.
- In CI/deploy, run `yarn build && yarn migration:run` prior to starting the app.

---

## Swagger / API Documentation

This repository includes API documentation tooling:

- NestJS Swagger (OpenAPI): the application may register a Swagger Document at startup (commonly exposed at `/api` or `/docs`). Check `src/main.ts` for `SwaggerModule` setup and the serve path.
- Compodoc (component/class documentation): available via the `docs` script in `package.json`.

Run Compodoc (UI):

```bash
yarn docs
# opens Compodoc static UI at http://localhost:3333 by default
```

Using Swagger:
1. Start the application (dev or prod) so the Swagger endpoint is available.
2. Visit the configured Swagger UI path (e.g., `http://localhost:3000/api` or `http://localhost:3000/docs`).
3. You can usually fetch the raw OpenAPI JSON at `http://localhost:3000/api-json` (path depends on setup).

If you don't see Swagger, search `src/main.ts` for `SwaggerModule.createDocument` or `DocumentBuilder` and verify the configured path.

---

## Common Developer Tasks

Run tests (unit):

```bash
yarn test
```

Run e2e tests:

```bash
yarn test:e2e
```

Format & lint:

```bash
yarn format
yarn lint
```

Find deprecated files (project helper):

```bash
yarn deprecated
```

---

## Debugging Tips

- Check environment variables and DataSource connectivity when DB-related errors occur.
- Use `psql` or `pgcli` to inspect the test/dev DB for migrations and session records.
- Tail logs when running `start:dev` to observe runtime errors.

---

## Troubleshooting Migrations

- If migrations fail in CI, ensure the DB is reachable and the `DATABASE_URL` is correct.
- For large migration sets, consider using a template DB or snapshot to speed CI startup.

---

## Summary

- `yarn start:dev` for iterative development.
- Use `yarn build && yarn migration:run` to prepare databases in CI and during deploys.
- Use `yarn docs` (Compodoc) and application Swagger endpoints for API docs.

If you'd like, I can:
- Add a `docker-compose.dev.yml` for a reproducible local stack
- Scaffold `.env.example` with required variables
