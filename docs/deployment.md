# Deployment

This document describes the deployment-related files and current operational constraints.

## Runtime Entry Point

Application startup is [src/main.ts](../src/main.ts):

```ts
await app.listen(8080);
```

The port is hardcoded to `8080`. No `PORT` environment variable is used.

## Production Commands

Relevant scripts from [package.json](../package.json):

```bash
pnpm run build
pnpm run migration:run
pnpm run start:prod
```

`start:prod` runs:

```bash
NODE_ENV=production node dist/main
```

Migrations require compiled output because the TypeORM data source points to `dist`.

## Dockerfile

File: [Dockerfile](../Dockerfile)

Stages:

- `base`: `node:22-alpine`, enables Corepack, copies package metadata.
- `deps`: installs dependencies with `pnpm install --frozen-lockfile`.
- `builder`: copies dependencies and source, runs `pnpm run build`.
- `dev`: copies dependencies and source, runs `pnpm run start:dev`.
- `test`: copies dependencies and source, runs `pnpm run test`.

Current limitation: no dedicated minimal production runtime stage exists.

## Entrypoints

### docker-entrypoint.sh

File: [docker-entrypoint.sh](../docker-entrypoint.sh)

Runs:

1. `pnpm run migration:run`
2. `node dist/main.js`

### docker-entrypoint-test.sh

File: [docker-entrypoint-test.sh](../docker-entrypoint-test.sh)

Runs:

1. `pnpm run build`
2. `pnpm run migration:run`
3. `pnpm run test:e2e`

## Development Docker Compose

File: [docker/development/docker-compose.yml](../docker/development/docker-compose.yml)

Services:

- `app`
- `postgres`
- `redis`

Current mismatches that need correction before relying on it:

- The app listens on `8080`, but Compose maps `3000:3000`.
- `.env.development` sets `DATA_SOURCE_HOST=localhost`; inside Compose it should point to the PostgreSQL service hostname, `postgres`.
- PostgreSQL service creates `nest_dev`, while `.env.development` uses `mintegs_db`.

## E2E Docker Compose

File: [docker/test/e2e/docker-compose.yml](../docker/test/e2e/docker-compose.yml)

This Compose file is aligned for CI e2e tests:

- App receives env vars directly.
- PostgreSQL host is `postgres`.
- Redis host is `redis`.
- App command runs `sh docker-entrypoint-test.sh`.

## GitHub Actions

### CI Pipeline

File: [.github/workflows/ci.yml](../.github/workflows/ci.yml)

Runs lint, build, unit tests, and Dockerized e2e tests on Node 22.

### Dependency Review

File: [.github/workflows/dependency-review.yml](../.github/workflows/dependency-review.yml)

Runs dependency checks on pull requests to `main`.

### Dependabot

File: [.github/dependabot.yml](../.github/dependabot.yml)

Checks Node package dependencies and GitHub Actions weekly.

## Operational Gaps

- No health endpoint.
- No readiness endpoint.
- No metrics endpoint.
- No structured logging setup.
- No graceful shutdown customization beyond test app shutdown hooks.
- No production Docker target.
- No `PORT` env variable.
- No CORS setup.
- No documented reverse proxy or TLS termination configuration.
