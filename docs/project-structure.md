# Project Structure

This document explains the repository layout and where to find the main implementation details.

## Top-Level Layout

```text
.
├── src/                         # Application source
├── test/                        # E2E test bootstrap, helpers, factories, and scenarios
├── docs/                        # Handwritten project documentation
├── documentation/               # Generated Compodoc output
├── docker/                      # Development and test Docker Compose files
├── Dockerfile                   # Multi-stage image definition
├── package.json                 # Scripts, dependencies, package metadata
├── tsconfig.json                # TypeScript compiler options and path aliases
├── tsconfig.build.json          # Build-specific TypeScript config
├── nest-cli.json                # Nest CLI config
├── jest.config.ts               # General Jest config
├── jest.unit.config.ts          # Unit-test Jest config
├── jest.e2e.config.ts           # E2E-test Jest config
├── eslint.config.mjs            # ESLint flat config
├── commitlint.config.ts         # Conventional commit rules
├── docker-entrypoint.sh         # Migration + app start script
└── docker-entrypoint-test.sh    # Build + migration + e2e test script
```

## Source Layout

```text
src/
├── main.ts
├── bootstrap.ts
├── app.module.ts
├── core/
├── features/
└── infrastructure/
```

### Entry Points

- [src/main.ts](../src/main.ts): creates the Nest app and listens on port `8080`.
- [src/bootstrap.ts](../src/bootstrap.ts): applies Swagger in development, Helmet, compression, URI versioning, and cookie parsing.
- [src/app.module.ts](../src/app.module.ts): imports `CoreModule`, `InfrastructureModule`, and `FeaturesModule`.

### Core

[src/core](../src/core) contains:

- `clock/`: `ClockService`, `ClockModule`, and time constants.
- `errors/`: `AppError`, error domains, general error codes, and `ErrorMapper`.
- `validation/rules/`: username and password regex rules.
- `registry-dates.ts`: shared timestamp shape.
- `utils/to-boolean.ts`: boolean coercion utility.

### Features

[src/features](../src/features) contains domain modules:

- `auth/`: registration, login, refresh, password change, auth cookies, hashing provider.
- `security/`: guards, decorators, exception filter, CSRF, rate limiting, device detection.
- `sessions/`: session entity, service, controller, DTOs, errors.
- `token/`: token service, JWT payload types, token errors.
- `users/`: user entity, service, controllers, DTOs, enums, errors.

### Infrastructure

[src/infrastructure](../src/infrastructure) contains external integrations and HTTP infrastructure:

- `config/`: Joi env validation and typed config factories for JWT and Redis; PostgreSQL config factory.
- `databases/postgres/`: TypeORM module, data source, migrations, embedded timestamp entity.
- `databases/redis/`: Redis provider, Redis wrapper service, counter service, lock helper.
- `http/`: shared DTOs, validation decorators, interceptors, request interfaces, Helmet config.
- `infrastructure.module.ts`: registers environment/database modules plus global validation and response wrapping.

## Tests

```text
test/
├── bootstrap/test-app.ts
├── factories/
├── helpers/
├── utils/
└── v1/
```

- Unit tests live beside their implementation files as `*.spec.ts`.
- E2E tests live under [test/v1](../test/v1).
- `test/bootstrap/test-app.ts` creates an in-process `INestApplication`.
- Helpers manage migrations, database truncation, Redis cleanup, cookies, and API clients.

## Documentation

- [docs](.) contains source-derived Markdown documentation.
- [documentation](../documentation) contains generated Compodoc HTML output and assets.

## Docker

```text
docker/
├── development/docker-compose.yml
└── test/
    ├── e2e/docker-compose.yml
    └── unit/docker-compose.yml
```

The e2e Compose file is used by CI. The development Compose file currently needs configuration alignment before it can run the application unchanged; see [deployment.md](deployment.md).

## Path Aliases

[tsconfig.json](../tsconfig.json) defines:

- `@features/*` -> `src/features/*`
- `@infrastructure/*` -> `src/infrastructure/*`
- `@core/*` -> `src/core/*`

Jest maps these aliases through `pathsToModuleNameMapper` in the Jest config files.
