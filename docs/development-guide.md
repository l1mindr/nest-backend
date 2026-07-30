# Development Guide

## Prerequisites

| Dependency | Version |
|------------|---------|
| Node.js | 22 |
| pnpm | 11.9.0 (via Corepack) |
| PostgreSQL | 17 |
| Redis | 7 |

## Setup

```bash
# Enable Corepack
corepack enable

# Install dependencies
pnpm install --frozen-lockfile

# Configure environment
cp .env.example .env
```

## Development Server

```bash
# Start with live reload
pnpm run start:dev

# Server listens on http://localhost:8080
# Swagger UI at http://localhost:8080/api (development only)
```

## Build

```bash
pnpm run build
# Output in dist/
```

## Migrations

```bash
# Build first, then run
pnpm run build
pnpm run migration:run

# Generate new migration after entity changes
pnpm run migration:generate src/infrastructure/databases/postgres/migrations/MyMigrationName

# Create empty migration
pnpm run migration:create src/infrastructure/databases/postgres/migrations/MyMigrationName

# Revert last migration
pnpm run migration:revert

# Show pending/executed migrations
pnpm run migration:show
```

## Testing

```bash
# Unit tests (colocated __tests__/)
pnpm run test:unit

# E2E tests (requires PostgreSQL + Redis running)
pnpm run test:e2e

# Dockerized E2E (builds image, starts dependencies)
pnpm run test:e2e:docker

# Single test file
npx jest --no-coverage --testPathPattern 'unsuspend-user.use-case'

# All users module tests
npx jest --no-coverage --testPathPattern 'src/features/users'
```

## Code Quality

```bash
pnpm run lint        # ESLint
pnpm run format      # Prettier
pnpm run typecheck   # tsc --noEmit
pnpm run build       # Full build
```

## Documentation

```bash
pnpm run docs        # Compodoc at http://localhost:3333
```

## Git Hooks

Configured via Husky:

| Hook | Action |
|------|--------|
| `pre-commit` | lint-staged (prettier + eslint on staged *.ts) |
| `commit-msg` | commitlint (conventional commit validation) |
| `pre-push` | build + deprecated file check |

### Commit Message Format

```
type(scope): subject

type: feat | fix | refactor | test | docs | chore | style | perf
scope: module name (kebab-case)
subject: imperative, lowercase, no period
```

---

## How to Create a New Feature

### 1. Create the module structure

```
src/features/my-feature/
├── application/
│   ├── interfaces/
│   │   └── my-feature.interface.ts
│   ├── mappers/
│   │   └── my-feature.mapper.ts
│   ├── services/
│   │   └── my-feature.service.ts
│   └── use-cases/
│       ├── __tests__/
│       │   └── my-feature.use-case.spec.ts
│       └── my-feature.use-case.ts
├── domain/
│   ├── entities/
│   │   └── my-feature.entity.ts
│   ├── enums/
│   └── errors/
│       ├── my-feature-error-code.enum.ts
│       └── my-feature-errors.ts
├── infrastructure/
│   └── repositories/
│       ├── __tests__/
│       └── my-feature.repository.ts
├── presentation/
│   ├── controllers/
│   ├── dto/
│   │   ├── request/
│   │   └── response/
│   └── swagger/
└── my-feature.module.ts
```

### 2. Define interfaces

In `application/interfaces/`:

```typescript
export const MY_FEATURE_REPOSITORY = Symbol('IMyFeatureRepository');

export interface IMyFeatureRepository {
  findById(id: string): Promise<MyEntity | null>;
}

export const MY_FEATURE_USE_CASE = Symbol('IMyFeatureUseCase');

export interface IMyFeatureUseCase {
  execute(params: ...): Promise<...>;
}
```

### 3. Implement the use case

- One class = one use case
- Inject dependencies via constructor using `@Inject(SYMBOL)`
- Use `DataSource.transaction()` for multi-step atomic operations
- Domain logic belongs in entity methods, not in the use case

### 4. Register in the module

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([MyEntity]), ...],
  controllers: [MyFeatureController],
  providers: [
    MyFeatureRepository,
    { provide: MY_FEATURE_REPOSITORY, useExisting: MyFeatureRepository },
    MyFeatureUseCase,
    { provide: MY_FEATURE_USE_CASE, useExisting: MyFeatureUseCase }
  ],
  exports: [MY_FEATURE_REPOSITORY, MY_FEATURE_USE_CASE]
})
export class MyFeatureModule {}
```

### 5. Add to features.module.ts

```typescript
import { MyFeatureModule } from './my-feature/my-feature.module';

@Module({
  imports: [AuthModule, ..., MyFeatureModule]
})
export class FeaturesModule {}
```

### 6. Follow dependency rules

| Location | Can import |
|----------|-----------|
| Use cases | Domain entities, interfaces, services |
| Services | Domain entities, interfaces |
| Repositories | Domain entities, TypeORM |
| Controllers | Use cases, DTOs, mappers |
| Domain | Nothing outside domain (pure TS only) |

### 7. Write tests

- Colocate in `__tests__/` at the same level as the implementation
- Mock dependencies directly (not via TestingModule for use cases)
- Cover: happy path, validation errors, transaction rollback, edge cases

---

## Path Aliases

| Alias | Path |
|-------|------|
| `@features/*` | `src/features/*` |
| `@infrastructure/*` | `src/infrastructure/*` |
| `@presentation/*` | `src/presentation/*` |
| `@core/*` | `src/core/*` |
