# Development Guide

This document explains how to work with the current project locally.

## Prerequisites

- Node.js 22.
- Corepack.
- Yarn 4.16.0.
- PostgreSQL.
- Redis.
- Docker and Docker Compose for containerized tests.

## Install Dependencies

```bash
corepack enable
yarn install --immutable
```

The project uses `nodeLinker: node-modules` in [.yarnrc.yml](../.yarnrc.yml).

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
yarn start:dev
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
yarn build
```

Nest writes compiled output to `dist/`.

## Migrations

Run migrations after building:

```bash
yarn build
yarn migration:run
```

Generate migrations:

```bash
yarn migration:generate
```

Revert the last migration:

```bash
yarn migration:revert
```

## Tests

```bash
yarn test:unit
yarn test:e2e
```

Dockerized e2e tests:

```bash
docker compose -f docker/test/e2e/docker-compose.yml up --build --abort-on-container-exit --exit-code-from app
docker compose -f docker/test/e2e/docker-compose.yml down -v
```

## Code Quality

```bash
yarn lint
yarn format
yarn build
```

`yarn lint` runs ESLint with `--fix`.

## Documentation

Compodoc:

```bash
yarn docs
```

This serves generated documentation at port `3333`.

Handwritten docs live in `docs/`.

## Git Hooks

Husky hooks:

- `pre-commit`: `npx lint-staged`
- `commit-msg`: `npx commitlint --edit --config ./commitlint.config.ts`
- `pre-push`: `yarn run build && yarn run deprecated`

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
