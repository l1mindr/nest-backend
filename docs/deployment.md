# Deployment

## Deployment Invariant

Every release uses one immutable image for both schema migration and application
runtime:

1. Build and publish the production image.
2. Create a one-shot container from that image and run
   `npm run migration:run`.
3. Start or update application replicas only after the migration exits with
   status `0`.

Application startup never runs migrations. This prevents every replica from
attempting the same schema change during a scale-out or rolling deployment.
TypeORM `migrationsRun` remains disabled intentionally.

A failed migration fails the release. Do not start the new application version
against a database that did not complete its migrations.

Only one release may migrate a database at a time. Configure the deployment
platform to serialize releases that target the same database.

## Production Image

[Dockerfile](../Dockerfile) is a multi-stage build with these targets:

- `dependencies`: installs the locked dependency graph once.
- `builder`: compiles only production source into `dist/`.
- `production-dependencies`: removes development dependencies after install.
- `development`: source-based development runtime.
- `test`: source-based test runtime.
- `production`: non-root runtime containing only `dist/`, production
  dependencies, and `package.json`.

`production` is the last stage. Therefore this command builds the production
image without requiring `--target`:

```bash
docker build --tag registry.example.com/nest-backend:${GIT_SHA} .
docker push registry.example.com/nest-backend:${GIT_SHA}
```

The image starts the API with `node dist/main.js`, runs as the unprivileged
`node` user, and exposes port `8080`. Environment files are excluded from the
build context and must be injected at runtime. The production image includes
the TypeORM CLI and compiled migrations so the same artifact can serve the
one-shot release job.

## Production Compose

[docker/production/docker-compose.yml](../docker/production/docker-compose.yml)
and [deploy.sh](../docker/production/deploy.sh) are the reference lifecycle for
a single-host Docker deployment. Compose defines:

- `migration`: a one-shot release job that runs `npm run migration:run`.
- `app`: the API process using the image's default command.
- A completion dependency that prevents `app` from starting unless `migration`
  succeeds when the full Compose project is started directly.

Use a unique immutable image reference for every release:

```bash
export APP_IMAGE=registry.example.com/nest-backend:${GIT_SHA}
export APP_ENV_FILE=/run/secrets/nest-backend.env

./docker/production/deploy.sh
```

`APP_ENV_FILE` defaults to `.env.production` at the repository root.
`APP_PORT` defaults to `8080`.

The script performs this exact sequence:

```bash
docker compose -f docker/production/docker-compose.yml pull
docker compose -f docker/production/docker-compose.yml run --rm --no-deps migration
docker compose -f docker/production/docker-compose.yml up -d --no-deps app
```

`docker compose run --rm` always creates a new migration container, including
when the same image is redeployed or a database is replaced. The shell exits
immediately if that job fails, so the application is not updated. TypeORM
records applied migrations, so a successful rerun only executes pending
migrations.

Treat `deploy.sh`, or the equivalent ordered release-job workflow in another
orchestrator, as the supported production deployment path. Do not start the
`app` service directly and bypass the migration job.

PostgreSQL and Redis are intentionally not defined in the production Compose
file. Production credentials should point to externally managed or separately
operated services.

## Other Orchestrators

Use the same ordering in Kubernetes, ECS, Nomad, or a CI/CD platform:

1. Build and publish one immutable image.
2. Create a one-shot pre-deploy job from that image with the production database
   environment.
3. Run `npm run migration:run`.
4. Require successful job completion before updating the application workload.
5. Cancel the rollout if the job fails.
6. Serialize release jobs that target the same database.

Do not run the migration command as the application container entrypoint, an
application init process attached to every replica, or a background task after
the rollout begins.

## Fresh Deployments

The migration job applies the full ordered migration history to an empty
database before the first application process starts. A fresh environment is
therefore upgraded to the schema expected by the image as part of deployment,
not through a manual post-deploy step.

The migration role must have permission to create and alter the required
database objects, including the `uuid-ossp` extension on a fresh database. If
production policy does not grant extension privileges to the migration role,
provision that extension before running the release job.

## Rollback Policy

Rolling back application containers does not automatically revert database
migrations. Production migrations should remain compatible with the previous
application version during a rolling release. Any database rollback must be a
separate reviewed operation; do not attach `migration:revert` to automated
deployment failure handling.

## Development And Test Images

Development Compose explicitly builds the `development` target:

```bash
docker compose -f docker/development/docker-compose.yml up --build
```

The unit Compose file explicitly builds the `test` target. E2E Compose first
builds the Dockerfile's default production stage and runs its one-shot migration
service against an empty PostgreSQL database. The `test` target starts only
after that job succeeds, then builds the source and runs the e2e suite.

CI also builds the Dockerfile without a target. This verifies that the default
final stage remains the production image. The image contract check verifies the
runtime command, non-root user, production environment, TypeORM CLI, data
source, and compiled migration artifacts. Dockerized E2E setup verifies that
the production image can upgrade a fresh database before application tests
start.
