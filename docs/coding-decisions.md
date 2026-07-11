# Coding Decisions

This document records decisions that are visible in the current implementation. It does not describe intended future architecture unless explicitly listed as a gap.

## Feature-First Organization

Business behavior is grouped under [src/features](../src/features) by feature:

- `auth`
- `security`
- `sessions`
- `token`
- `users`

This keeps controllers, services, DTOs, entities, errors, and feature-specific interfaces close together.

## Thin Controllers

Controllers mostly declare:

- Route path and version.
- HTTP method and status.
- Decorators for auth, rate limit, CSRF, Swagger, and serialization.
- Parameter extraction.

Workflow logic lives in services such as `AuthService`, `UsersService`, and `SessionsService`.

## Global Guards

The project uses global guards for authentication, authorization, rate limiting, and CSRF. This means new routes are protected by default unless explicitly marked public.

Important decorators:

- `@Public()`
- `@Roles(...)`
- `@RateLimit(...)`
- `@SkipCsrf()`

## Cookie-Based JWT Auth

The implementation stores access and refresh JWTs in cookies instead of using `Authorization: Bearer` headers. This decision is paired with:

- HTTP-only token cookies.
- CSRF double-submit protection.
- Server-side session validation on every authenticated request.

## Server-Side Session Validation

Access tokens are not accepted by signature alone. `TokenService.validatePayload()` also requires:

- Existing user.
- Active, non-revoked, non-expired session.

This allows server-side revocation to invalidate access to protected routes.

## Refresh Rotation With Database Guard

Refresh rotation stores only the current refresh token hash on the session and uses a conditional update on:

- Session ID.
- Current refresh hash.
- Current session version.

This creates a single-winner update in PostgreSQL. Redis is also called in the refresh flow, but the current Redis lock helper does not provide strict mutual exclusion.

## Provider Abstraction for Hashing

`HashingProvider` is abstract and is bound to `BcryptProvider` in `AuthModule`. This isolates most auth code from direct `bcrypt` calls.

## Clock Abstraction

`ClockService` centralizes current time and session expiry calculation. This makes time behavior easier to test and change.

Current values:

- Access token: 15 minutes in `TokenService`.
- Refresh/session expiry: 7 days in `ClockService.snapshot()`.

## Structured Domain Errors

Feature errors return `AppError` with:

- code
- domain
- HTTP status code
- metadata
- message

`GlobalExceptionFilter` maps these into a stable error response envelope.

## Response Wrapping

`DataResponseInterceptor` globally wraps successful handler return values as:

```json
{
  "data": {}
}
```

This is a project-wide API contract.

## Explicit Serialization

Selected endpoints use `@Serialize(ResponseDto)` to transform entities into controlled response shapes.

The serialization interceptor uses:

```ts
excludeExtraneousValues: true
```

Only fields with `@Expose()` are returned.

## Current Decisions to Revisit

- `RedisLockService.acquire()` should use `NX` if it is intended to be a real lock.
- `UpdateUserRequestDto` allows `status` on the current-user profile endpoint.
- `UserStatus` is not enforced during login or authorization.
- The application port is hardcoded.
- Development Docker Compose does not match runtime config.
- Both `yarn.lock` and `package-lock.json` exist while package metadata declares Yarn.
