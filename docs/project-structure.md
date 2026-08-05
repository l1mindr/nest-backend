# Project Structure

## Repository Layout

```
nest-backend/
├── docs/                   # Architecture documentation
├── docker/                 # Docker Compose files
│   ├── development/
│   ├── production/
│   └── test/
├── scripts/                # Utility scripts
├── src/                    # Application source
├── test/                   # E2E and integration tests
├── Dockerfile              # Multi-stage build
├── commitlint.config.ts
├── eslint.config.mjs       # Flat config with architecture rules
├── jest.config.ts
├── jest.e2e.config.ts
├── jest.unit.config.ts
├── tsconfig.json
├── tsconfig.build.json
├── tsconfig.eslint.json
└── package.json
```

---

## Source Layout

```
src/
├── main.ts                         # Bootstrap entry point
├── bootstrap.ts                    # App setup (Swagger, Helmet, etc.)
├── app.module.ts                   # Composition root
│
├── core/                           # Framework-agnostic pure TypeScript
│   ├── errors/
│   │   ├── app.error.ts
│   │   ├── domain-error-code.enum.ts
│   │   └── error-domain.enum.ts
│   ├── pagination/
│   │   ├── __tests__/
│   │   ├── cursor.util.ts
│   │   ├── paginate.util.ts
│   │   └── paginated-result.interface.ts
│   ├── utils/
│   │   └── to-boolean.ts
│   ├── validation/
│   │   └── rules/
│   │       ├── password.rules.ts
│   │       └── username.rules.ts
│   └── registry-dates.ts
│
├── presentation/                   # Shared HTTP concerns
│   ├── dto/
│   │   ├── error-response.dto.ts
│   │   ├── id.dto.ts
│   │   └── timestamp-response.dto.ts
│   ├── interfaces/
│   │   ├── context/                # Auth, device, session context
│   │   └── custom-request.interface.ts
│   ├── interceptors/
│   │   ├── decorators/
│   │   │   └── serialize.decorator.ts
│   │   ├── data-response.interceptor.ts
│   │   └── serialize.interceptor.ts
│   ├── validation/
│   │   ├── decorators/
│   │   ├── fields/
│   │   └── pipe/
│   └── presentation.module.ts
│
├── infrastructure/                 # External adapters & framework integrations
│   ├── clock/
│   ├── config/
│   │   ├── databases/
│   │   ├── env/
│   │   ├── jsonwebtoken/
│   │   └── security/
│   ├── databases/
│   │   ├── postgres/
│   │   │   ├── embedded/
│   │   │   ├── migrations/
│   │   │   ├── data-source.ts
│   │   │   └── postgres.module.ts
│   │   └── redis/
│   │       ├── __tests__/
│   │       ├── keys/
│   │       ├── redis-counter.service.ts
│   │       ├── redis-lock.service.ts
│   │       ├── redis.service.ts
│   │       └── redis.module.ts
│   ├── email/
│   ├── errors/
│   ├── http/
│   ├── logging/
│   └── infrastructure.module.ts
│
├── features/                       # Business feature modules
│   ├── auth/
│   ├── authorization/
│   ├── coin-tracker/
│   ├── security/
│   ├── sessions/
│   ├── token/
│   ├── users/
│   └── features.module.ts
│
└── types/
    └── express.d.ts                # Express Request augmentation
```

---

## Feature Module Layout

Every business feature follows a consistent internal structure.

### Standard feature:

```
feature/
├── application/
│   ├── interfaces/       # Ports (Symbol tokens) and contracts
│   ├── mappers/          # Entity-to-DTO mapping
│   ├── services/         # Reusable application services
│   └── use-cases/        # Business orchestration
│       └── __tests__/    # Colocated unit tests
├── domain/
│   ├── entities/         # Domain entities (TypeORM decorated)
│   ├── enums/            # Statuses, roles, etc.
│   ├── errors/           # Domain error factories
│   └── types/            # Shared domain types (optional)
├── infrastructure/
│   └── repositories/     # Data access implementation
│       └── __tests__/    # Colocated repository tests
├── presentation/
│   ├── controllers/      # HTTP entry points
│   ├── decorators/       # Feature-specific param decorators
│   ├── dto/              # Request/response DTOs
│   │   ├── request/
│   │   └── response/
│   └── swagger/          # API documentation decorators
└── feature.module.ts
```

### Security module (cross-cutting):

```
security/
├── csrf/                 # CSRF token service, guard, interceptors
├── device-detection/     # Device fingerprinting, user-agent parsing
├── errors/               # Security domain errors
├── filters/              # Global exception filter
├── guards/               # JwtGuard, RolesGuard
├── hashing/              # SecurityHasher (keyed digests)
├── rate-limit/           # Multi-dimensional rate limiting framework
│   ├── config/           # rate-limit.config.ts — every limit in the app
│   ├── decorators/       # @RateLimit
│   ├── guards/           # RateLimitGuard
│   ├── resolvers/        # One per identifier type, plus the registry
│   ├── services/         # Store (Lua), key builder, evaluator, logging
│   ├── types/            # Rule, result, identifier enum
│   └── utils/            # Safe raw-body field extraction
├── strategies/           # JwtStrategy
├── decorators/           # @Public, @Roles, @User, @Session
└── security.module.ts
```

### Token module (reusable library):

```
token/
├── application/
│   └── services/         # Token issue, verification, validation
├── errors/               # Token domain errors
├── interfaces/           # JWT payload interfaces
└── token.module.ts
```

---

## Test Colocation

Unit tests are **colocated** inside `__tests__/` directories at the same level as the implementation file:

```
correct:
  pagination/
  ├── __tests__/
  │   ├── cursor.util.spec.ts
  │   └── paginate.util.spec.ts
  ├── cursor.util.ts
  ├── paginate.util.ts
  └── paginated-result.interface.ts

incorrect:
  pagination/
  ├── cursor.util.spec.ts       # Alongside implementation
  ├── cursor.util.ts
  └── paginate.util.ts
```

Test files are named after the file they test:
- `cursor.util.spec.ts` → tests `cursor.util.ts`
- `create-user.use-case.spec.ts` → tests `create-user.use-case.ts`
- `redis.service.spec.ts` → tests `redis.service.ts`

---

## Path Aliases

Configured in `tsconfig.json` and jest configs:

| Alias | Path |
|-------|------|
| `@features/*` | `./src/features/*` |
| `@infrastructure/*` | `./src/infrastructure/*` |
| `@presentation/*` | `./src/presentation/*` |
| `@core/*` | `./src/core/*` |

---

## Test Directories

```
test/
├── bootstrap/            # createTestApp() helper
├── helpers/              # PostgreSQL, Redis, API client utilities
├── factories/            # UserFactory, AuthFactory
├── integration/          # Integration tests (e2e)
└── v1/                   # API version 1 e2e tests
```
