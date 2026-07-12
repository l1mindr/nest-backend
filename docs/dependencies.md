# Dependencies

This document groups the packages declared in [package.json](../package.json) and explains how they are used.

## Runtime Dependencies

### NestJS

- `@nestjs/common`
- `@nestjs/core`
- `@nestjs/platform-express`
- `@nestjs/config`
- `@nestjs/jwt`
- `@nestjs/mapped-types`
- `@nestjs/swagger`
- `@nestjs/typeorm`

Used for the application framework, configuration, JWT integration, Swagger decorators, DTO mapped types, and TypeORM integration.

### Persistence and Redis

- `typeorm`
- `pg`
- `ioredis`

TypeORM and `pg` provide PostgreSQL persistence. `ioredis` is used for Redis counters and refresh-flow key helpers.

### HTTP Middleware

- `compression`
- `cookie-parser`
- `helmet`

Configured in `setupApp()`.

### Auth and Validation

- `bcrypt`
- `class-transformer`
- `class-validator`
- `joi`
- `reflect-metadata`
- `rxjs`

`bcrypt` hashes passwords and refresh tokens. `class-validator` and `class-transformer` validate and transform DTOs. `joi` validates environment variables. `rxjs` is used by Nest interceptors.

### User Agent Parsing

- `ua-parser-js`

Used by `UserAgentParser` in device detection.

### Other Runtime Packages

- `chalk`

Declared as a dependency, but no direct source usage was found during documentation inspection.

## Development Dependencies

### Nest and TypeScript Tooling

- `@nestjs/cli`
- `@nestjs/schematics`
- `@nestjs/testing`
- `typescript`
- `ts-node`
- `ts-loader`
- `tsconfig-paths`

Used for building, schematics, testing, and path alias support.

### Testing

- `jest`
- `ts-jest`
- `supertest`
- `source-map-support`
- `@types/jest`
- `@types/supertest`

Used for unit and e2e tests.

### Linting and Formatting

- `eslint`
- `@eslint/js`
- `@eslint/eslintrc`
- `@typescript-eslint/eslint-plugin`
- `@typescript-eslint/parser`
- `eslint-config-prettier`
- `eslint-plugin-prettier`
- `prettier`

Configured through [eslint.config.mjs](../eslint.config.mjs) and [.prettierrc](../.prettierrc).

### Git Hooks and Commit Rules

- `husky`
- `lint-staged`
- `@commitlint/cli`
- `@commitlint/config-conventional`
- `@commitlint/types`
- `conventional-changelog-atom`

Used by Husky hooks and commitlint.

### Documentation

- `@compodoc/compodoc`

Used by `pnpm run docs`.

### Type Definitions

- `@types/bcrypt`
- `@types/compression`
- `@types/cookie-parser`
- `@types/express`
- `@types/ioredis`
- `@types/node`

Provide TypeScript types.

## Package Manager

`packageManager` is:

```json
"pnpm@11.9.0"
```

The repository uses `pnpm-lock.yaml` as the single dependency lockfile. Legacy package-manager lockfiles are intentionally not kept.

`pnpm-workspace.yaml` contains a pnpm override for `@compodoc/compodoc>@angular-devkit/schematics`.
Compodoc 2.0.0 declares `@angular-devkit/schematics@22.0.4`, whose matching `@angular-devkit/core@22.0.4` is not published in the registry. The override keeps Compodoc on the published Angular DevKit `21.2.13` line so `pnpm install --frozen-lockfile` can resolve consistently.

The same file also makes pnpm's build-script policy explicit through `allowBuilds`: `bcrypt` is allowed to run its native install build, while the transitive `@scarf/scarf` postinstall script is disabled.

## Dependency Automation

- [.github/dependabot.yml](../.github/dependabot.yml): weekly Node package and GitHub Actions updates.
- [.github/workflows/dependency-review.yml](../.github/workflows/dependency-review.yml): outdated and audit checks.
