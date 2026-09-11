# CI/CD

The backend pipeline is `.github/workflows/ci.yml`. Two jobs run in parallel on
`ubuntu-latest`.

Related: [testing.md](testing.md), [docker.md](docker.md).

## Triggers

- **Push** to `main` or `master` only. Pull requests already validate every
  feature branch; restricting pushes stops each PR commit running the pipeline
  twice.
- **Pull request** against any branch.

Both ignore `**.md`, `docs/**`, `documentation/**`, and `.vscode/**`.

`permissions: contents: read` — nothing in the pipeline writes to the repository.

Concurrency is grouped by workflow and ref. In-flight runs are cancelled for
pull requests but never for `main`/`master`, so every commit that lands stays
validated.

## Job: `quality` — Lint • Type Check • Unit

```
corepack enable
  → actions/setup-node@v7 (Node 24, pnpm cache keyed on pnpm-lock.yaml)
  → restore .jest-cache
  → pnpm install --frozen-lockfile --prefer-offline
  → pnpm run lint:check      # eslint, no --fix
  → pnpm run typecheck       # tsc -p tsconfig.json --noEmit
  → pnpm run test:unit       # jest --config jest.unit.config.ts
```

`lint:check` rather than `lint`: the latter carries `--fix`, which would let a
violation pass by silently rewriting it on the runner.

The Jest cache is restored because ts-jest re-transpiles every spec and every
file it imports on a cold cache. The directory is ~3 MB and Jest validates each
entry against file contents, so a stale restore can only ever be a miss.

## Job: `e2e` — Image • Migrations • E2E

`COMPOSE_FILE` is set to `docker/test/e2e/docker-compose.yml` for every step.

```
docker/setup-buildx-action@v4
  → build production image  (tags: nest-backend:ci, nest-backend-e2e-migration:latest)
  → production image contract
  → build e2e image         (target: test, tag: nest-backend-e2e-app:latest)
  → docker compose up -d --wait postgres redis mongo mailpit
  → docker compose run --rm --no-deps migration
  → docker compose run --rm --no-deps app
  → docker compose down -v            (always)
```

### Image builds

The production image is built first and tagged twice, so Compose reuses it for
the `migration` service instead of running a second build of its own. Layer
caching uses the registry-independent GitHub Actions cache
(`cache-from: type=gha`, `cache-to: type=gha,mode=max`).

The E2E image shares the `dependencies` stage with the production image, so only
the source copy on top is rebuilt. It deliberately exports no cache: that top
layer changes with every commit and is worthless to store.

### Production image contract

An explicit assertion that the shipped image is what it claims to be, run before
anything depends on it:

- `CMD` is exactly `["node","dist/main.js"]`
- `NODE_ENV=production`
- the process does **not** run as root
- `dist/main.js`, the compiled data source, and an executable `typeorm` binary
  all exist
- at least one compiled migration is present
- `typeorm` resolves

`nest build` is not run separately on the runner: the production image builds the
same output in its `builder` stage and this contract asserts the result.

### Services

`postgres`, `redis`, `mongo`, and `mailpit` are started with `--wait`, so the
step does not return until every healthcheck passes.

`mailpit` is in that list because the E2E run uses `--no-deps`: the
delivered-email specs under `test/email/` need an SMTP server that accepts a
message and serves it back, and nothing else would start one. See
[email.md](email.md).

### Migrations

Run from the **production** image, not the test image — the same artifact that
would run them in a real deployment.

### E2E run

`docker compose run --rm --no-deps app` executes `pnpm run test:e2e` as defined
by the Compose service command.

## Worker configuration

The E2E lane runs Jest with a bounded worker count:

```
E2E_MAX_WORKERS=2
```

It is set on the `app` service in `docker/test/e2e/docker-compose.yml` and read
by `jest.e2e.config.ts`, which validates it and caps it at the 15 usable Redis
databases. It is pinned there rather than passed as a flag in the workflow step
so that running the same Compose command locally reproduces the runner's worker
count instead of only this step's.

### Why bounded

Not for CPU. Each worker boots a whole Nest application — Postgres pool, Redis,
Mongo, BullMQ — and Node sizes each worker's heap from the machine's *total*
memory, so N workers each grow as though they owned the box. Measured at roughly
1.9 GB resident per worker:

| Workers | Outcome | Peak RSS |
|---------|---------|----------|
| 8 | 20/36 suites, 28 workers SIGKILLed | 6120 MiB |
| 4 | 34/36 suites, 4 workers SIGKILLed | 5941 MiB |
| 3 | 36/36 suites | 5152 MiB |
| 2 | 36/36 suites | 3908 MiB |

When the kernel OOM-killer terminates a worker mid-`beforeAll`, Jest reports
`Test suite failed to run` and "Exceeded timeout of 30000 ms for a hook". Both
look like a flaky application; neither is. **Grepping a red run for `SIGKILL`
separates resource starvation from a real regression.**

A GitHub Actions standard runner is 2 vCPU / 7 GB. Two workers fit with headroom
and put one worker per core. Three passes on an 8 GB Docker host but leaves too
little margin for the smaller runner.

This is a memory-safety choice for this suite on this runner class — not a claim
that 2 is optimal generally. On a host with more memory, raise `E2E_MAX_WORKERS`.

## Related workflows

| Workflow | Purpose |
|----------|---------|
| `.github/workflows/dependency-review.yml` | Dependency review on pull requests |
| `.github/workflows/dependency-scan.yml` | Dependency vulnerability scanning |
| `.github/dependabot.yml` | Dependency update automation |

Commit messages are linted locally by a Husky `commit-msg` hook running
commitlint; no workflow enforces it on the runner.

## Frontend

The frontend has no GitHub Actions workflow in this repository. Its commands are
documented in `next-dashboard-frontend/docs/testing.md`.
