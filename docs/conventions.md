# Coding Conventions

This document defines project-wide coding conventions: naming rules, folder structure guidelines, DTO conventions, provider patterns, and error-handling patterns. Follow these to keep code consistent, testable, and maintainable.

---

## Naming Rules

- Files:
  - Use kebab-case for filenames: `user-controller.ts` → `users.controller.ts` (keep consistent with Nest conventions).
  - Use `.controller.ts`, `.service.ts`, `.module.ts`, `.dto.ts`, `.entity.ts` suffixes for clarity.
- Types / Classes / Enums:
  - PascalCase: `UserService`, `CreateUserDto`, `SessionVersion`.
- Interfaces & Types:
  - Use `I` prefix sparingly. Prefer descriptive names: `UserDto`, `UserRepository` (no `IUser`).
- Variables / Functions / Methods:
  - camelCase for local variables and functions: `createUser()`, `userRepository`.
- Constants:
  - UPPER_SNAKE_CASE for application-wide constants; prefer grouped exported enums or const objects when scoping is needed.
- Database Columns / DTO properties:
  - Use snake_case in DB columns (via entity mappings) and camelCase in DTOs and code. Use TypeORM column decorators to map names.

Rationale: consistent naming reduces cognitive load and matches community and NestJS idioms.

---

## Folder Structure Rules

Top-level layout (high-level rules):
- `src/core/` — framework-agnostic utilities, providers, and cross-cutting concerns.
- `src/features/<feature>/` — feature-first modules containing `controllers`, `services`, `dto`, and `entities` for that feature.
- `src/infrastructure/` — adapters: databases, redis, http, config, and concrete provider implementations.
- `test/` — testing helpers, factories, and fixtures.

Feature module layout:
- `src/features/auth/`:
  - `auth.module.ts`
  - `controllers/` (e.g., `auth.controller.ts`)
  - `services/` (e.g., `auth.service.ts`)
  - `dto/` (create, update, query DTOs)
  - `entities/` (ORM entities specific to the feature)

Rules:
- Keep features self-contained. Avoid cross-feature imports unless through well-defined interfaces.
- Infrastructure code must not depend on features; features depend on core + infrastructure.
- Place tests next to code where practical (e.g., `users.service.spec.ts` alongside `users.service.ts`) or under `test/` for integration/E2E helpers.

Rationale: feature-first organization improves ownership and navigability.

---

## DTO Conventions

- Use `class` DTOs with `class-validator` + `class-transformer` decorators.
- Naming: `CreateXDto`, `UpdateXDto`, `XResponseDto`, `XQueryDto`.
- Keep DTOs focused: one DTO per request/response shape.
- Use `@IsNotEmpty()`, `@IsString()`, `@IsEmail()`, and other validators explicitly.
- Enable global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` to reject unexpected fields.
- Transform primitives (e.g., `@Type(() => Number)`) where necessary.
- Avoid business logic in DTOs; use them only for validation and transformation.

Example:

```ts
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

Rationale: DTOs ensure stable API contracts and guard business logic from malformed inputs.

---

## Provider Patterns

- Provide small, single-responsibility providers (ClockProvider, HashingProvider, TokenProvider, RedisService).
- Define TypeScript interfaces in `src/core/providers` and register concrete implementations in `src/infrastructure`.
- Use NestJS DI tokens for provider interfaces to allow easy substitution in tests and environments.

Registration pattern:
- Export interfaces and tokens from `src/core/providers/index.ts`.
- In `infrastructure` modules, provide the concrete implementation using `useClass` or `useFactory` with configured parameters.

Testing pattern:
- Provide a `TestProvidersModule` used by tests to override implementations with fakes.
- Keep provider APIs small: `hash`, `verify`; `now`; `sign`, `verify` — avoid leaking implementation details.

Rationale: decouples business code from libraries and centralizes security-sensitive operations.

---

## Error Handling Patterns

- Use domain-specific error classes that extend `Error` (e.g., `AuthError`, `NotFoundError`, `ValidationError`).
- Throw `HttpException` (Nest) or map domain errors to `HttpException` in controllers or a global exception filter.
- Standardize error response format (e.g., `{ statusCode, error, message, details? }`).
- Avoid exposing stack traces or sensitive info in responses; log full details server-side with correlation IDs.
- Use an `AppError` base class with properties: `code`, `details`, and optional `metadata` for structured logs.
- For validation, rely on `class-validator` and map to `400` responses via built-in pipes.

Example mapping:

- `NotFoundError` -> 404
- `UnauthorizedError` -> 401
- `ForbiddenError` -> 403
- `ConflictError` (e.g., duplicate email) -> 409
- `ValidationError` -> 400

Rationale: consistent error handling improves client UX and eases monitoring.

---

## Miscellaneous Guidelines

- Keep controllers thin: orchestration only, delegate business logic to services.
- Avoid business logic in entities; use services and domain objects.
- Prefer explicit imports over deep, ambiguous barrel files to reduce circular dependencies.
- Enforce formatting and linting with `prettier` and `eslint` (project has scripts configured).
- Write small, focused PRs and include docs updates for any architecture changes.

---

## Enforcing Conventions

- Run `yarn lint` and `yarn format` before committing.
- Use `lint-staged` and `husky` hooks (project configured) to enforce pre-commit rules.
- Add CI checks for lint, type, and test coverage.

---

## Next Steps

- Add concrete interface files under `src/core/providers` and examples of `useFactory` wiring.
- Add a `CONTRIBUTING.md` referencing these conventions and PR checklist.
