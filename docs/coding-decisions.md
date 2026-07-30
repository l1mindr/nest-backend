# Architecture Decision Records

## ADR-001: Feature-Oriented Module Layout

**Status**: Accepted

**Context**: The application needs to scale across multiple business domains while maintaining clear separation of concerns.

**Decision**: Organize source code into four top-level layers — `core/`, `presentation/`, `infrastructure/`, `features/` — and within features, follow a consistent `presentation/application/domain/infrastructure` structure.

**Consequences**:
- New features follow a predictable pattern
- Cross-cutting concerns live in `security/` (not scattered across features)
- Domain logic is isolated from NestJS framework concerns (with known debt for ORM decorators)
- See `project-structure.md` for complete layout

---

## ADR-002: Presentation Layer Separation

**Status**: Accepted

**Context**: HTTP concerns (DTOs, interceptors, validation decorators) were mixed with business logic, making it hard to evolve the API surface independently.

**Decision**: Extract shared HTTP infrastructure into `src/presentation/`. Feature-specific presentation concerns stay in `features/*/presentation/`.

**Consequences**:
- Shared DTOs (`IdDto`, `ErrorResponseDto`) are reused across features
- `DataResponseInterceptor` and `SerializeInterceptor` are registered once
- Reusable validation decorators (`EmailField`, `PasswordField`) avoid duplication
- Presentation layer is prevented from importing `@infrastructure/*` (enforced by ESLint)

---

## ADR-003: Core as Framework-Agnostic Pure TypeScript

**Status**: Accepted

**Context**: Shared utilities (errors, pagination, validation rules) should not depend on NestJS, TypeORM, Express, or any runtime-specific library.

**Decision**: Create `src/core/` containing only pure TypeScript with zero external dependencies.

**Consequences**:
- `AppError`, `ErrorDomain`, pagination utilities, and validation regex rules are usable in any context
- Core is imported by all layers but imports nothing from them
- Enforced by ESLint `no-restricted-imports` — core cannot import `@nestjs/*`, `typeorm`, `express`, `@infrastructure/*`, `@features/*`, `@presentation/*`
- Can be extracted to a separate package if needed

---

## ADR-004: Infrastructure Contains All Adapters

**Status**: Accepted

**Context**: Framework integrations (TypeORM, Redis, Pino logger, email, clock) need to be swappable without affecting business logic.

**Decision**: Place all external adapters in `src/infrastructure/`. Business logic in features only depends on abstractions (interfaces/symbols), not concrete implementations.

**Consequences**:
- `ClockService` lives in infrastructure (not core) because it depends on `@nestjs/common` (`@Injectable`) and is a framework-integrated service
- `EmailService` is abstract in infrastructure with `ConsoleEmailService` as the default implementation — swap out the module provider to switch implementations
- `ErrorMapper` lives in `infrastructure/errors/` because it maps domain errors to HTTP responses — it knows about NestJS `HttpStatus`
- Databases, Redis, logging all have clear ownership boundaries

---

## ADR-005: Use Cases as Isolated Orchestrators

**Status**: Accepted

**Context**: Business logic was scattered across services with unclear boundaries, making changes risky and testing difficult.

**Decision**: Use cases are single-responsibility classes that orchestrate business operations. One class = one use case.

**Rules**:
- Use cases are injected through interface + Symbol tokens
- Controllers call use cases directly (no intermediate service layer)
- Use cases never call other use cases — shared logic is extracted into application services
- Business orchestration lives in use cases; reusable operations live in services
- No repositories, no controllers, no framework logic in use cases

**Consequences**:
- Use cases are easy to test (plain class instantiation with mocked dependencies)
- Use cases are easy to reason about (one operation per class)
- Service layer is reserved for genuinely reusable operations
- See `authentication.md`, `sessions.md` for use case details

---

## ADR-006: ESLint-Enforced Architecture Boundaries

**Status**: Accepted

**Context**: Without enforcement, architectural rules degrade over time as developers import freely across layers.

**Decision**: Enforce layer isolation via `@typescript-eslint/no-restricted-imports` in the ESLint flat config.

**Rules**:
- `src/core/**`: Cannot import `@nestjs/*`, `typeorm`, `express`, `@infrastructure/*`, `@features/*`, `@presentation/*`
- `src/presentation/**`: Cannot import `@infrastructure/*`
- `src/features/*/presentation/**`: Cannot import `@infrastructure/*`

**Consequences**:
- Architecture violations are caught during development and CI
- New contributors get immediate feedback on correct import patterns
- Rules are enforced automatically, not through code review alone
- Domain layer isolation is documented but not yet enforced (known debt — entities carry ORM decorators)

---

## ADR-007: Colocated Tests in `__tests__/`

**Status**: Accepted

**Context**: Tests placed directly beside implementation files (`user.service.ts` / `user.service.spec.ts`) cluttered directory listings and made it harder to distinguish implementation from tests.

**Decision**: Place unit tests inside `__tests__/` directories at the same level as the implementation file.

```
correct:
  cursor.util.ts
  __tests__/cursor.util.spec.ts
```

**Consequences**:
- Cleaner directory listings — implementation files are visually distinct from test files
- Tests are still colocated with their implementation (same directory level)
- Consistent pattern across the entire project — `repositories/__tests__/`, `services/__tests__/`, `use-cases/__tests__/`, `mappers/__tests__/`
- Build exclusion is straightforward (`**/*spec.ts`)

---

## ADR-008: Cookie-Based JWT with Server-Side Session Validation

**Status**: Accepted

**Context**: Token-based authentication needs security (prevent XSS token theft) while maintaining server-side control over session lifecycle.

**Decision**: Store JWTs in httpOnly cookies, validate every request against the database (not just JWT signature), and implement refresh token rotation with optimistic concurrency.

**Consequences**:
- httpOnly cookies prevent XSS-based token theft
- Server-side validation allows immediate session revocation (suspend, password change)
- Refresh rotation with version-based optimistic concurrency detects token reuse
- Trade-off: database query on every authenticated request (mitigated by indexing on `(owner, isRevoked, expiresAt)`)

---

## ADR-009: Global Guards for Cross-Cutting Concerns

**Status**: Accepted

**Context**: Authentication, authorization, and CSRF protection must apply to all routes by default without requiring per-route decorators.

**Decision**: Register `JwtGuard`, `RolesGuard`, and `CsrfGuard` as global `APP_GUARD` providers. Use `@Public()` and `@SkipCsrf()` decorators to opt out.

**Consequences**:
- New routes are automatically protected — no boilerplate
- Exemptions are explicit and searchable
- Guard ordering matters: JwtGuard runs first, then RolesGuard, then CsrfGuard
- Rate limiting is NOT global — applied via `@RateLimit()` decorator where needed

---

## ADR-010: Domain Status Transitions via Entity Methods

**Status**: Accepted

**Context**: User status was being manipulated directly (`user.status = UserStatus.ACTIVATE`) across multiple locations, duplicating validation logic.

**Decision**: Encapsulate status transitions in domain entity methods. The `User` entity owns its status lifecycle.

```typescript
class User {
  unsuspend(): void {
    if (this.status !== UserStatus.SUSPEND) {
      throw UserErrors.invalidStatusTransition(this.status, UserStatus.ACTIVATE);
    }
    this.status = UserStatus.ACTIVATE;
  }
}
```

**Consequences**:
- Status transition rules are defined once in the entity
- Invalid transitions throw `INVALID_STATUS_TRANSITION` domain error
- Use cases and controllers cannot bypass validation
- New transitions follow the same pattern (e.g., `user.suspend()`)

---

## ADR-011: Transaction Boundary — Status Update Only

**Status**: Accepted

**Context**: Multi-step operations (unsuspend user → send email → create log) need atomicity guarantees without holding transactions open for I/O operations.

**Decision**: Only data-modifying database operations are wrapped in transactions. Side effects (email, logging) happen after commit.

**Correct flow**:
```
BEGIN TRANSACTION
    Update user status
COMMIT

After commit:
    Send email notification
    Create security log
```

**Consequences**:
- Database consistency is guaranteed
- Email is never sent if the transaction fails
- Transactions stay short (no I/O inside transaction)
- Side idempotency is a consideration (email might be sent twice if app crashes after commit)

---

## Known Debt

1. **Domain entities carry TypeORM decorators** — `@Entity`, `@Column`, `@OneToMany` leak ORM into domain. Requires entity refactoring with separate ORM models.
2. **Error classes import `HttpStatus` from `@nestjs/common`** — Domain errors know about HTTP. Requires moving HTTP mapping to infrastructure layer.
3. **Redis lock for refresh does not use `NX`** — Not a strict lock. Relies on database conditional update as authoritative mechanism.
4. **`UpdateUserRequestDto` permits `status`** — Users could theoretically update their own status via the profile endpoint.
5. **No CORS configuration** — Add if frontend is served from a different origin.
