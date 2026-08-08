# Modules

## AppModule

Composition root. Imports InfrastructureModule, PresentationModule, LoggingModule, and FeaturesModule.

Does not register any providers itself.

---

## Core

Framework-agnostic shared logic lives in `src/core/` (e.g. `AppError`, `ErrorDomain`, `RegistryDates`). It is not a NestJS module — Core is imported by direct file reference through path aliases.

---

## PresentationModule (`src/presentation/presentation.module.ts`)

Registers global NestJS providers:

- `APP_PIPE` → `ValidationPipe` with whitelist + forbidNonWhitelisted + 422 on error
- `APP_INTERCEPTOR` → `DataResponseInterceptor` (wraps responses in `{ data: ... }`)

---

## LoggingModule (`src/infrastructure/logging/logging.module.ts`)

**Global module.** Configures `LoggerModule.forRootAsync()` from `nestjs-pino`.

- Uses pino-pretty transport in non-production
- Auto-generates `x-request-id` per request
- Adds correlationId, IP, userId, sessionId as custom log properties
- Redacts authorization cookies and headers

---

## InfrastructureModule (`src/infrastructure/infrastructure.module.ts`)

Imports:

| Module | Description |
|--------|-------------|
| `EnvModule` | Environment validation with Joi |
| `DatabasesModule` | PostgreSQL + Redis connectivity |
| `ClockModule` | Time utilities |
| `EmailModule` | Abstract email + SmtpEmailService |

### EnvModule

Global module. Registers `ConfigModule.forRoot()` with Joi validation schema. Reads `.env.${NODE_ENV}` then `.env`.

Exports: ConfigModule (indirectly)

### DatabasesModule

Imports `PostgresModule` and `RedisModule`.

#### PostgresModule

Configures `TypeOrmModule.forRootAsync()` using `postgresConfig` factory. `autoLoadEntities: true`.

#### RedisModule

**Global module.** Provides:

| Provider | Token |
|----------|-------|
| `RedisService` | `RedisService` (class) |
| `RedisLockService` | `RedisLockService` (class) |
| `RedisCounterService` | `RedisCounterService` (class) |
| Redis client | `REDIS_CLIENT` (Symbol) |

Exports: `RedisLockService`, `RedisCounterService`

### ClockModule

**Global module.** Provides `ClockService` for time operations (`nowMs()`, `nowDate()`, `addDaysFrom()`, `snapshot()`).

### EmailModule

**Global module.** Provides abstract `EmailService` with concrete `SmtpEmailService` implementation.

---

## FeaturesModule (`src/features/features.module.ts`)

Imports:

| Module | Description |
|--------|-------------|
| `AuthModule` | Authentication flows |
| `AuthorizationModule` | Roles, permissions, permission evaluation, administrator management |
| `CoinTrackerModule` | Cryptocurrency tracking |
| `SecurityModule` | Cross-cutting guards, filters, strategies |
| `SessionsModule` | Session lifecycle |
| `TokenModule` | JWT token services |
| `UsersModule` | User management |

---

## AuthModule (`src/features/auth/auth.module.ts`)

Imports: `UsersModule`, `SessionsModule`, `TokenModule`, `DeviceDetectionModule`, `CsrfModule`

Controllers: `AuthController`

**Use Cases** (each injected via Symbol):

| Symbol | Implementation | Responsibility |
|--------|---------------|----------------|
| `REGISTER` | `Register` | User registration |
| `LOGIN` | `Login` | User login + session issue |
| `CHANGE_PASSWORD` | `ChangePassword` | Password change with session revocation |
| `REFRESH` | `Refresh` | Token refresh with rotation |

**Services:**
- `AuthCookieService` — Sets httpOnly JWT cookies + CSRF cookie on response

**Providers:**
- `HashingProvider` (abstract) → `Argon2Provider` — Argon2id password hashing + legacy bcrypt verification
- `RefreshTokenHasher` — SHA-256 hashing for refresh token storage

---

## SecurityModule (`src/features/security/security.module.ts`)

**Global guards and filter** registered via `APP_*` tokens:

| Provider | Scope |
|----------|-------|
| `JwtGuard` | `APP_GUARD` — validates access_token on every request (unless `@Public()`) |
| `RolesGuard` | `APP_GUARD` — checks `@Roles()` metadata against the role tier, by rank so the owner satisfies any tier |
| `PermissionGuard` | `APP_GUARD` — checks `@RequirePermissions()` metadata through `PermissionEvaluationService` |
| `CsrfGuard` | `APP_GUARD` — validates CSRF double-submit for unsafe methods (unless `@SkipCsrf()`) |
| `GlobalExceptionFilter` | `APP_FILTER` — maps all errors to `{ error: ... }` format |

Imports: `JwtModule`, `TokenModule`, `AuthorizationModule`, `DeviceDetectionModule`, `RateLimitModule`, `CsrfModule`

### CsrfModule

Provides:
- `CsrfTokenService` — Structured token generation (`nonce.expiresAt.signature`, HMAC-SHA256)
- `CsrfValidationService` — Signature/expiry verification + cookie vs header comparison (timing-safe)
- `CsrfGuard` — Global CSRF validation
- `ClearCsrfCookieInterceptor` — Clears CSRF cookie on logout

Decorators: `@SkipCsrf()` — marks routes as CSRF-exempt

### RateLimitModule

Provides:
- `RateLimitService` — Counting entry point: `consume` / `peek` / `reset`
- `RateLimitEvaluatorService` — Applies a route's policy group, fail-fast
- `RateLimitStoreService` — Fixed window plus temporary block, atomic in Lua
- `RateLimitKeyBuilder` — HMAC'd Redis keys and log-safe fingerprints
- `RateLimitLogService` — The only emitter of rate limit events
- `RateLimitResolverRegistry` — Indexes one resolver per identifier type
- `RateLimitGuard` — Applies rate limiting to decorated routes

Decorators: `@RateLimit(RateLimitPolicies.Auth.Login)` or `@RateLimit({ policies: [...] })`

Configuration: `rate-limit/config/rate-limit.config.ts` — the single source of every limit

### DeviceDetectionModule

Provides:
- `DeviceMiddleware` — Global middleware, parses User-Agent
- `DeviceDetectorService` — User-Agent parsing via `ua-parser-js`
- `FingerprintService` — Device fingerprint generation
- `DeviceMapper` — Maps raw UA data to `DeviceContext`

---

## SessionsModule (`src/features/sessions/sessions.module.ts`)

Imports: `TypeOrmModule.forFeature([Session])`

Controllers: `SessionsController`

Exports:

| Symbol | Implementation |
|--------|---------------|
| `SESSION_REPOSITORY` | `SessionRepository` |
| `SESSION_CURSOR_SERVICE` | `SessionCursorService` |
| `SESSION_QUERY_SERVICE` | `SessionQueryService` |
| `SESSION_LIST_SERVICE` | `SessionListService` |
| `SESSION_ISSUE_USE_CASE` | `SessionIssueUseCase` |
| `SESSION_ROTATION_USE_CASE` | `SessionRotationUseCase` |
| `SESSION_REVOCATION_USE_CASE` | `SessionRevocationUseCase` |

---

## TokenModule (`src/features/token/token.module.ts`)

Imports: `JwtModule`, `UsersModule`, `SessionsModule`

Exports:

| Symbol | Implementation |
|--------|---------------|
| `TOKEN_ISSUE_SERVICE` | `TokenIssueService` |
| `TOKEN_VERIFICATION_SERVICE` | `TokenVerificationService` |
| `TOKEN_VALIDATION_SERVICE` | `TokenValidationService` |

JWT secrets: Access token (15min, audience `api`), Refresh token (7d, audience `refresh`). Separate secrets from env.

---

## UsersModule (`src/features/users/users.module.ts`)

Imports: `TypeOrmModule.forFeature([User, UserVerificationCode])`, `SessionsModule`

Controllers: `UsersController`, `AdminUsersController`

Exports:

| Symbol | Implementation |
|--------|---------------|
| `USER_REPOSITORY` | `UserRepository` |
| `USER_QUERY_SERVICE` | `UserQueryService` |
| `CREATE_USER_USE_CASE` | `CreateUserUseCase` |
| `VERIFICATION_CODE_REPOSITORY` | `VerificationCodeRepository` |
| `INITIATE_REGISTRATION_USE_CASE` | `InitiateRegistrationUseCase` |
| `RESEND_VERIFICATION_USE_CASE` | `ResendVerificationUseCase` |
| `CLEANUP_PENDING_USERS_USE_CASE` | `CleanupPendingUsersUseCase` |

---

## Module Communication

```
AuthController
  → RegisterUseCase      → UserRepository, HashingProvider
  → LoginUseCase          → UserRepository, HashingProvider,
                            SessionIssueUseCase, TokenIssueService
  → RefreshUseCase        → TokenVerificationService, TokenValidationService,
                            SessionRotationUseCase, TokenIssueService,
                            RedisLockService
  → ChangePasswordUseCase → UserRepository, HashingProvider,
                            SessionRevocationUseCase (with manager)

SessionsController
  → SessionListService    → SessionCursorService, SessionQueryService
  → SessionRevocationUseCase  → SessionRepository

AdminUsersController
  → AdminUsersUseCase     → UserRepository
  → SuspendUserUseCase    → UserRepository, SessionRevocationUseCase,
                            EmailService, ClockService
  → UnsuspendUserUseCase  → UserRepository, EmailService, ClockService

JwtGuard → JwtStrategy
  → TokenVerificationService → TokenValidationService
    → UserQueryService, SessionQueryService
```

---

## Circular Dependencies

TokenModule imports UsersModule and SessionsModule. AuthModule imports TokenModule. No circular references exist because TokenModule does not import AuthModule — the dependency graph is acyclic.
