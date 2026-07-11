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
yarn build
yarn migration:run
yarn start:prod
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
- `deps`: installs dependencies with `yarn install --immutable`.
- `builder`: copies dependencies and source, runs `yarn build`.
- `dev`: copies dependencies and source, runs `yarn start:dev`.
- `test`: copies dependencies and source, runs `yarn test`.

Current limitation: no dedicated minimal production runtime stage exists.

## Entrypoints

### docker-entrypoint.sh

File: [docker-entrypoint.sh](../docker-entrypoint.sh)

Runs:

1. `npm run migration:run`
2. `node dist/main.js`

Note: package metadata and CI use Yarn, but this script uses `npm run`.

### docker-entrypoint-test.sh

File: [docker-entrypoint-test.sh](../docker-entrypoint-test.sh)

Runs:

1. `yarn build`
2. `yarn migration:run`
3. `yarn test:e2e`

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
- The app command is `npm run start:dev`, while the package manager is declared as Yarn.

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

Checks npm dependencies and GitHub Actions weekly.

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
