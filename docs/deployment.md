# Deployment

## Principle

One immutable image for migration and runtime.

```
Build image → Run migration (one-shot) → Start application replicas
```

Application never runs migrations automatically (`migrationsRun: false`).

## Image

Multi-stage Dockerfile:

| Stage | Purpose |
|-------|---------|
| `dependencies` | Install production dependencies |
| `builder` | Build TypeScript → JavaScript |
| `production-dependencies` | Pruned node_modules (production only) |
| `development` | Dev server with hot reload |
| `test` | Run e2e tests |
| `production` | Runtime image (dist + production node_modules) |

Production image runs as non-root `node` user. Port `8080`.

## Database Migrations

```bash
# Build image first, then run migration as one-shot job
docker run --rm <image> pnpm run migration:run

# Start application replicas
docker run <image>
```

- Only one release may migrate a database at a time (serialized releases)
- Fresh deployments: full migration history runs against empty database
- `uuid-ossp` PostgreSQL extension required by migrations

## Production Compose

```yaml
services:
  migration:
    image: <image>
    command: pnpm run migration:run
    depends_on:
      postgres:
        condition: service_healthy
  app:
    image: <image>
    depends_on:
      migration:
        condition: service_completed_successfully
```

## Other Orchestrators

Same ordered workflow regardless of platform:

1. Run migration (one-shot pre-deploy job)
2. Update workload (rolling, blue-green, etc.)

## Rollback

- No automatic migration revert
- Rollback requires a separate reviewed migration operation
- Revert via `pnpm run migration:revert`

## Development / Test

| Environment | Docker Target | Purpose |
|-------------|---------------|---------|
| Development | `development` | Hot-reload server |
| Test (E2E) | `production` → migration → `test` | Build once, migrate, run tests |

## Environment Variables

Required in all environments:

- `DATA_SOURCE_USERNAME`, `DATA_SOURCE_PASSWORD`, `DATA_SOURCE_HOST`, `DATA_SOURCE_PORT`, `DATA_SOURCE_DATABASE`
- `REDIS_HOST`, `REDIS_PORT` (plus `REDIS_PASSWORD` in production)
- `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `CSRF_TOKEN_SECRET`
- `MAX_ACTIVE_SESSIONS`
- `NODE_ENV` (development, production, test, or staging)

## CI Pipeline

```
corepack enable
pnpm install --frozen-lockfile
├── lint (ESLint)
├── typecheck (tsc --noEmit)
├── build (nest build)
├── unit tests (jest --config jest.unit.config.ts)
├── build production Docker image
└── dockerized e2e (docker-compose -f docker/test/e2e)
```
