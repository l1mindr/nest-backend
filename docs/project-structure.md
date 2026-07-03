# Project Structure

This document explains the repository layout and where to find major parts of the application.

---

## Purpose

- Provide a quick orientation for contributors
- Show where to find source, tests, docs, and infrastructure code
- Document common scripts and run/test commands

---

## Top-level files

- `package.json` — project scripts and dependencies
- `tsconfig.json`, `tsconfig.build.json` — TypeScript configuration
- `nest-cli.json` — Nest CLI configuration
- `README.md` — project overview
- `docs/` — hand-written architecture and design docs
- `documentation/` — generated API docs (Compodoc)
- `test/` — test bootstrap, helpers, factories
- `jest.*.config.ts` — Jest configurations
- `commitlint.config.ts`, `eslint.config.mjs` — linting and commit rules

---

## Source layout (`src/`)

Main entry points:

- `app.module.ts` — root module
- `bootstrap.ts`, `main.ts` — application bootstrap

---

### Primary directories

- `core/`  
	Framework-agnostic utilities and shared abstractions  
	(DTOs, validation, `ClockService`, interceptors, transforms)

- `features/`  
	Feature-first business modules (auth, users, sessions, token, security)

- `infrastructure/`  
	External adapters and integrations (databases, Redis, HTTP, config)

---

## Infrastructure details

- `infrastructure/databases/postgres` — TypeORM setup, migrations, entities
- `infrastructure/databases/redis` — Redis service, locking, caching
- `infrastructure/config` — environment and configuration providers
- `infrastructure/http` — HTTP adapters and transport layer utilities

---

## Tests

- Unit tests: `yarn test` (`jest.unit.config.ts`)
- E2E tests: `yarn test:e2e` (`jest.e2e.config.ts`)
- Test utilities and factories: `test/`

---

## Common scripts

### Development

- `yarn start:dev` — development mode with watch
- `yarn build` — compile TypeScript to `dist/`
- `yarn start:prod` — run production build

### Code quality

- `yarn lint` — ESLint
- `yarn format` — Prettier

### Testing

- `yarn test` — unit tests
- `yarn test:e2e` — e2e tests

### Migrations

- `yarn migration:generate`
- `yarn migration:run`
- `yarn migration:revert`

### Docs

- `yarn docs` — Compodoc UI

---

## Architecture conventions

- Feature-first structure (business logic grouped by domain)
- Strict separation:
	- `core` → framework-independent logic
	- `features` → business logic
	- `infrastructure` → external systems
- No direct dependency from features → infrastructure
- Business logic stays ORM-agnostic

---

## Where to start

1. Read `docs/architecture.md`
2. Explore `src/features/*`
3. Run `yarn start:dev`
4. Check logs and follow feature flow

---

## Notes

- Core logic is reusable and framework-agnostic
- Infrastructure is replaceable by design
- Features are the main unit of development
