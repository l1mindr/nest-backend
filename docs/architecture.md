# Architecture

## Overview

NestJS HTTP API with a layered, feature-oriented architecture.

Four top-level source layers:

```
src/
├── core/              # Framework-agnostic pure TypeScript
├── presentation/      # Shared HTTP/presentation concerns
├── infrastructure/    # External adapters and framework integrations
└── features/          # Business feature modules
```

---

## Layer Responsibilities

### Core Layer (`src/core/`)

**Framework-agnostic shared logic.** Contains only pure TypeScript with zero dependencies on NestJS, TypeORM, Express, Redis, Axios, or any external adapter.

- `errors/` — `AppError` base class, `ErrorDomain` enum, `DomainErrorCode` enum
- `pagination/` — Cursor encoding/decoding, pagination utility, `PaginatedResult` interface
- `validation/rules/` — Username and password regex rules (shared constants, no decorators)
- `utils/` — Pure utility functions (`toBoolean`)
- `registry-dates.ts` — Base `RegistryDates` class (without ORM decorators)

Core is imported by all layers but imports nothing from them.

### Presentation Layer (`src/presentation/`)

**Shared HTTP concerns.** Contains only NestJS decorators, DTOs, interceptors, and validation utilities that are reused across feature modules.

- `dto/` — Shared DTOs (`IdDto`, `ErrorResponseDto`, `TimestampResponseDto`)
- `interceptors/` — `DataResponseInterceptor` (global `{ data: ... }` wrapper), `SerializeInterceptor` (per-route DTO serialization)
- `interfaces/` — `IRequest` (extended Express Request), auth/device/session context interfaces
- `validation/` — Reusable field decorators (`EmailField`, `PasswordField`, `UsernameField`), validation decorators (`IsPassword`, `IsUsername`, `TrimLowercase`), global `ValidationPipe` configuration

This layer **must not contain business logic**. Feature-specific presentation concerns live in `features/*/presentation/`.

### Infrastructure Layer (`src/infrastructure/`)

**External adapters and framework integrations.** Contains database connections, Redis, logging, email, clock, HTTP configuration, and environment validation.

- `clock/` — `ClockService` (time utilities) and `ClockModule`. Belongs in infrastructure because it depends on `@nestjs/common` (`@Injectable`) and is a framework-integrated service.
- `config/` — Environment validation (Joi), JWT config, Redis config, PostgreSQL config, CSRF config
- `databases/` — PostgreSQL (TypeORM setup, migrations, embedded `RegistryDatesOrm`), Redis (ioredis client, counter, lock)
- `email/` — Abstract `EmailService`, `SmtpEmailService` implementation (Nodemailer)
- `errors/` — `ErrorMapper` (maps `AppError` to HTTP response shape)
- `http/` — Helmet security headers configuration
- `logging/` — Pino logger setup (`LoggingModule`), `LogEvent` enum, redaction config

### Features Layer (`src/features/`)

**Business feature modules.** Each feature follows a consistent internal structure.

Standard feature layout:

```
feature/
├── application/
│   ├── interfaces/     # Ports & contracts (Symbol tokens)
│   ├── mappers/        # Entity-to-DTO mapping
│   ├── services/       # Reusable application services
│   └── use-cases/      # Business orchestration (one class = one use case)
├── domain/
│   ├── entities/       # Domain entities (with ORM decorators — known debt)
│   ├── enums/          # Domain enums
│   └── errors/         # Domain error factories
├── infrastructure/
│   └── repositories/   # Data access implementations
├── presentation/
│   ├── controllers/    # HTTP entry points
│   ├── decorators/     # Feature-specific decorators
│   ├── dto/            # Request/response DTOs
│   └── swagger/        # API documentation decorators
└── feature.module.ts
```

Current features:

| Feature | Responsibility |
|---------|---------------|
| `auth/` | Registration, login, refresh, change password |
| `authorization/` | Role hierarchy, permission model, permission evaluation, administrator management |
| `coin-tracker/` | Cryptocurrency price tracking, price alerts |
| `security/` | Cross-cutting guards, filters, CSRF, rate limiting, device detection |
| `sessions/` | Session lifecycle (issue, rotate, revoke, list) |
| `token/` | JWT signing, verification, validation (reusable library) |
| `users/` | User CRUD, admin operations (suspend, unsuspend, list), verification |

---

## Module Graph

```
AppModule
├── LoggingModule (global — nestjs-pino)
├── PresentationModule (global ValidationPipe, DataResponseInterceptor)
├── InfrastructureModule
│   ├── EnvModule (Joi validation)
│   ├── DatabasesModule
│   │   ├── PostgresModule (TypeORM)
│   │   └── RedisModule (ioredis — global)
│   ├── ClockModule (global)
│   └── EmailModule (global)
└── FeaturesModule
    ├── AuthModule
    │   ├── UsersModule, SessionsModule, TokenModule
    │   ├── DeviceDetectionModule, CsrfModule
    │   └── Providers: HashingProvider -> BcryptProvider
    ├── CoinTrackerModule
    ├── SecurityModule (global guards + filter)
    │   ├── JwtGuard, RolesGuard, CsrfGuard (APP_GUARD)
    │   ├── GlobalExceptionFilter (APP_FILTER)
    │   ├── DeviceDetectionModule
    │   ├── RateLimitModule
    │   └── CsrfModule
    ├── SessionsModule
    ├── TokenModule
    └── UsersModule
```

---

## Cross-Cutting Concerns

| Concern | Mechanism | Scope |
|---------|-----------|-------|
| Authentication | `JwtGuard` (reads `access_token` cookie) | Global (`APP_GUARD`) |
| Authorization | `RolesGuard` (checks `@Roles()` metadata) | Global (`APP_GUARD`) |
| CSRF Protection | `CsrfGuard` (double-submit pattern) | Global (`APP_GUARD`) |
| Rate Limiting | `@RateLimit()` decorator + `RateLimitGuard` | Per-route |
| Device Detection | `DeviceMiddleware` | Global |
| Validation | `ValidationPipe` (whitelist, forbidNonWhitelisted, 422) | Global (`APP_PIPE`) |
| Response Envelope | `DataResponseInterceptor` (`{ data: ... }`) | Global (`APP_INTERCEPTOR`) |
| Serialization | `@Serialize(Dto)` + `SerializeInterceptor` | Per-route |
| Error Handling | `GlobalExceptionFilter` (maps `AppError` -> `{ error: ... }`) | Global (`APP_FILTER`) |
| Cookie Auth | `AuthCookieInterceptor` (sets httpOnly JWT cookies) | Login/refresh |

---

## Dependency Rules

```
Presentation → Application → Domain
                                    ↑
Infrastructure implements ports      │
Core ←───────────────────────────────┘
```

| Source | May Not Import |
|--------|---------------|
| `core/` | `@nestjs/*`, `typeorm`, `express`, `@infrastructure/*`, `@features/*`, `@presentation/*` |
| `presentation/**` | `@infrastructure/*` |
| `features/*/presentation/**` | `@infrastructure/*` |
| `features/*/domain/**` | `@nestjs/*`, `typeorm`, `@infrastructure/*`, `@presentation/*` (aspirational — see known debt) |

Enforced via ESLint `@typescript-eslint/no-restricted-imports`.

---

## Known Architectural Debt

- Domain entities carry TypeORM decorators (`@Entity`, `@Column`, `@OneToMany`)
- Error classes use `HttpStatus` from `@nestjs/common`
- Domain layer import isolation is documented but not yet enforced in ESLint
- `name` field on `User` has `select: false` (must be explicitly selected)
- `password` field on `User` has `select: false`
