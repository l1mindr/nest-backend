# Development Guide

This document explains how to work with the current project locally.

## Prerequisites

- Node.js 22.
- Corepack.
- pnpm 11.9.0.
- PostgreSQL.
- Redis.
- Docker and Docker Compose for containerized tests.

## Install Dependencies

```bash
corepack enable
pnpm install --frozen-lockfile
```

The project uses [pnpm-lock.yaml](../pnpm-lock.yaml) as its single package-manager lockfile.

## Environment Setup

Create a local env file:

```bash
cp .env.example .env
```

Set a single `NODE_ENV` value and provide valid PostgreSQL, Redis, and JWT values.

See [configuration.md](configuration.md) for the full environment variable list.

## Run Locally

Start PostgreSQL and Redis, then run:

```bash
pnpm run start:dev
```

The app listens on:

```text
http://localhost:8080
```

Swagger is available in development:

```text
http://localhost:8080/api
```

## Build

```bash
pnpm run build
```

Nest writes compiled output to `dist/`.

## Migrations

Run migrations after building:

```bash
pnpm run build
pnpm run migration:run
```

Generate migrations:

```bash
pnpm run migration:generate
```

Revert the last migration:

```bash
pnpm run migration:revert
```

## Tests

```bash
pnpm run test:unit
pnpm run test:e2e
```

Dockerized e2e tests:

```bash
docker compose -f docker/test/e2e/docker-compose.yml build migration app
docker compose -f docker/test/e2e/docker-compose.yml up -d --wait postgres redis
docker compose -f docker/test/e2e/docker-compose.yml run --rm --no-deps migration
docker compose -f docker/test/e2e/docker-compose.yml run --rm --no-deps app
docker compose -f docker/test/e2e/docker-compose.yml down -v
```

## Code Quality

```bash
pnpm run lint
pnpm run format
pnpm run build
```

`pnpm run lint` runs ESLint with `--fix`.

## Documentation

Compodoc:

```bash
pnpm run docs
```

This serves generated documentation at port `3333`.

Handwritten docs live in `docs/`.

## Git Hooks

Husky hooks:

- `pre-commit`: `pnpm exec lint-staged`
- `commit-msg`: `pnpm exec commitlint --edit --config ./commitlint.config.ts`
- `pre-push`: `pnpm run build && pnpm run deprecated`

Commitlint requires:

- Conventional commit type.
- Non-empty scope.
- Kebab-case scope.
- Non-empty subject.

## Common Development Notes

- The application port is hardcoded to `8080`.
- Public routes must use `@Public()`.
- Unsafe public routes must use `@SkipCsrf()` only when intentional.
- DTOs are validated globally; unexpected fields are rejected.
- Add migrations for entity changes.
- Use response DTOs with `@Serialize()` when returning entities or entity-derived data.
