# Dependencies

## Runtime

### NestJS & Framework

| Package | Purpose |
|---------|---------|
| `@nestjs/common` | Decorators, guards, interceptors, pipes, filters |
| `@nestjs/core` | NestJS runtime |
| `@nestjs/platform-express` | Express adapter |
| `@nestjs/config` | Environment configuration with Joi |
| `@nestjs/swagger` | OpenAPI documentation |
| `@nestjs/jwt` | JWT signing and verification |
| `@nestjs/schedule` | Cron jobs (pending user cleanup, coin sync, price check) |
| `@nestjs/axios` | HTTP client (coin-tracker) |
| `axios` | Underlying HTTP client for CoinGecko calls |
| `reflect-metadata` | TypeScript decorator metadata |
| `rxjs` | Reactive extensions |

### Database & Cache

| Package | Purpose |
|---------|---------|
| `typeorm` | ORM (v1.1.0) |
| `@nestjs/typeorm` | NestJS TypeORM integration |
| `pg` | PostgreSQL driver |
| `ioredis` | Redis client |

### Security

| Package | Purpose |
|---------|---------|
| `bcrypt` | Password hashing (10 rounds) |
| `helmet` | HTTP security headers |
| `cookie-parser` | Cookie extraction |
| `jsonwebtoken` | JWT utilities (internal use) |

### Validation & Serialization

| Package | Purpose |
|---------|---------|
| `class-validator` | DTO validation decorators |
| `class-transformer` | DTO serialization and transformation |
| `joi` | Environment schema validation |

### Logging

| Package | Purpose |
|---------|---------|
| `nestjs-pino` | NestJS Pino integration |
| `pino` | Structured logger |
| `pino-http` | HTTP request logging |

### Other

| Package | Purpose |
|---------|---------|
| `compression` | Response compression |
| `ua-parser-js` | User-Agent parsing |
| `dotenv` | Environment file loading |
| `dotenv-expand` | Variable expansion in .env |

## Dev Dependencies

### Tooling

| Package | Purpose |
|---------|---------|
| `@nestjs/cli` | NestJS CLI (build, generate) |
| `@nestjs/schematics` | Code generation |
| `typescript` | TypeScript compiler |
| `ts-node` | TypeScript execution |
| `tsconfig-paths` | Path alias resolution |

### Testing

| Package | Purpose |
|---------|---------|
| `jest` | Test runner |
| `ts-jest` | TypeScript Jest transformer |
| `@nestjs/testing` | Test module bootstrapping |
| `supertest` | HTTP assertions |
| `@types/supertest` | Type definitions |

### Code Quality

| Package | Purpose |
|---------|---------|
| `eslint` | Linter |
| `@typescript-eslint/parser` | TypeScript ESLint parser |
| `@typescript-eslint/eslint-plugin` | TypeScript ESLint rules |
| `eslint-config-prettier` | Prettier integration |
| `eslint-plugin-prettier` | Prettier as ESLint rule |
| `prettier` | Code formatter |

### Git Hooks

| Package | Purpose |
|---------|---------|
| `husky` | Git hooks |
| `lint-staged` | Staged file processing |
| `@commitlint/cli` | Commit message validation |
| `@commitlint/config-conventional` | Conventional commit rules |

### Documentation

| Package | Purpose |
|---------|---------|
| `@compodoc/compodoc` | Documentation generation |

## Package Manager

`pnpm@11.9.0` with `pnpm-lock.yaml`.

## Automation

- **Dependabot**: Weekly dependency updates
- **Dependency review workflow**: `pnpm audit` and `pnpm outdated` checks in CI on pull requests
- **Dependency scan workflow**: Weekly scheduled `pnpm audit --audit-level=high` plus OSV scanner on pushes/PRs to `master`

## Build

```bash
pnpm install --frozen-lockfile
pnpm run build  # nest build → dist/
```
