# Configuration

This document explains runtime configuration and environment variables.

## Relevant Files

- [src/infrastructure/config/env/env.module.ts](../src/infrastructure/config/env/env.module.ts)
- [src/infrastructure/config/env/env.schema.ts](../src/infrastructure/config/env/env.schema.ts)
- [src/infrastructure/config/databases/postgres.config.ts](../src/infrastructure/config/databases/postgres.config.ts)
- [src/infrastructure/config/databases/redis.config.ts](../src/infrastructure/config/databases/redis.config.ts)
- [src/infrastructure/config/jsonwebtoken/jwt.config.ts](../src/infrastructure/config/jsonwebtoken/jwt.config.ts)
- [.env.example](../.env.example)
- [.env.development](../.env.development)
- [.env.test](../.env.test)

## Config Loading

`EnvModule` registers `ConfigModule.forRoot()` globally with:

```ts
envFilePath: [`.env.${process.env.NODE_ENV}`, '.env']
```

It also sets:

- `isGlobal: true`
- `expandVariables: true`
- `validationSchema: ENV_VALIDATION_SCHEMA`
- `load: [jwtConfig, redisConfig]`

The PostgreSQL config factory is used directly by TypeORM and is not included in the `load` array.

## Environment Variables

The Joi schema requires:

| Variable | Required | Type in Joi | Purpose |
| --- | --- | --- | --- |
| `DATA_SOURCE_USERNAME` | Yes | string | PostgreSQL username. |
| `DATA_SOURCE_PASSWORD` | Yes | string | PostgreSQL password. |
| `DATA_SOURCE_HOST` | Yes | string | PostgreSQL host. |
| `DATA_SOURCE_PORT` | Yes | number | PostgreSQL port. |
| `DATA_SOURCE_DATABASE` | Yes | string | PostgreSQL database. |
| `REDIS_HOST` | Yes | string | Redis host. |
| `REDIS_PORT` | Yes | string | Redis port. |
| `REDIS_PASSWORD` | No | string | Redis password. |
| `REDIS_DB` | No | string | Redis database number. |
| `JWT_SECRET_KEY` | Yes | string | JWT signing secret. |
| `NODE_ENV` | Yes | string | Runtime environment. |

`.env.example` currently shows `NODE_ENV=development,production,test`. Use a single value such as `development`, `production`, or `test`.

## JWT Config

File: [src/infrastructure/config/jsonwebtoken/jwt.config.ts](../src/infrastructure/config/jsonwebtoken/jwt.config.ts)

Registered namespace: `jwt`

Fields:

- `secret`: `process.env.JWT_SECRET_KEY`

The code uses a symmetric secret for both signing and verification.

## Redis Config

File: [src/infrastructure/config/databases/redis.config.ts](../src/infrastructure/config/databases/redis.config.ts)

Registered namespace: `redis`

Fields:

- `host`
- `port`
- `password`
- `db`

Defaults:

- Host: `localhost`
- Port: `6379`
- DB: `0`

## PostgreSQL Config

File: [src/infrastructure/config/databases/postgres.config.ts](../src/infrastructure/config/databases/postgres.config.ts)

Registered namespace: `database`

Fields:

- `type: 'postgres'`
- `autoLoadEntities: true`
- `url`: constructed PostgreSQL connection URL.

## TypeScript and Path Aliases

[tsconfig.json](../tsconfig.json) configures:

- `target: ES2021`
- `module: commonjs`
- `outDir: ./dist`
- decorator metadata support
- path aliases for `@features/*`, `@infrastructure/*`, and `@core/*`

Strictness settings are relaxed:

- `strictNullChecks: false`
- `noImplicitAny: false`
- `strictBindCallApply: false`

## Package Manager

[package.json](../package.json) declares:

```json
"packageManager": "yarn@4.16.0"
```

The repository also contains `package-lock.json`. Current package metadata points to Yarn, and CI uses Yarn.

## Configuration Gaps

- No app-level port environment variable exists; [src/main.ts](../src/main.ts) hardcodes port `8080`.
- No CORS configuration exists.
- No configuration exists for JWT issuer, audience, algorithm, or key rotation.
- No configuration exists for bcrypt cost by environment.
- No validation restricts `NODE_ENV` to known values.
