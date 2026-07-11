# Security

This document lists security controls that are implemented in the current code and the gaps that were not found in the repository.

## Implemented Controls

### Password Hashing

Files:

- [src/features/auth/providers/hashing.provider.ts](../src/features/auth/providers/hashing.provider.ts)
- [src/features/auth/providers/bcrypt.provider.ts](../src/features/auth/providers/bcrypt.provider.ts)

`HashingProvider` is an abstract provider. `AuthModule` binds it to `BcryptProvider`.

`BcryptProvider.hash()`:

- Generates a salt with default rounds `10`.
- Hashes passwords and refresh tokens.

`BcryptProvider.compare()` uses `bcrypt.compare()`.

### JWT Cookies

Files:

- [src/features/token/token.service.ts](../src/features/token/token.service.ts)
- [src/features/auth/interceptors/auth-cookie.interceptor.ts](../src/features/auth/interceptors/auth-cookie.interceptor.ts)

Access and refresh tokens are signed JWTs and are set as HTTP-only cookies:

- `access_token`: 15 minutes.
- `refresh_token`: 7 days.

In production, cookies are `secure: true` and `sameSite: 'strict'`. In other environments, `secure: false` and `sameSite: 'lax'`.

### CSRF Protection

Files:

- [src/features/security/csrf/csrf.module.ts](../src/features/security/csrf/csrf.module.ts)
- [src/features/security/csrf/guards/csrf.guard.ts](../src/features/security/csrf/guards/csrf.guard.ts)
- [src/features/security/csrf/csrf.service.ts](../src/features/security/csrf/csrf.service.ts)
- [src/features/security/csrf/decorators/skip-csrf.decorator.ts](../src/features/security/csrf/decorators/skip-csrf.decorator.ts)

`CsrfGuard` is global. It allows:

- Routes decorated with `@SkipCsrf()`.
- Safe methods: `GET`, `HEAD`, `OPTIONS`.

For unsafe methods it requires:

- `csrf_token` cookie.
- Matching `x-csrf-token` header.

The token is generated with `randomBytes(32).toString('hex')`.

### Rate Limiting

Files:

- [src/features/security/rate-limit/rate-limit.module.ts](../src/features/security/rate-limit/rate-limit.module.ts)
- [src/features/security/rate-limit/guards/rate-limit.guard.ts](../src/features/security/rate-limit/guards/rate-limit.guard.ts)
- [src/features/security/rate-limit/rate-limit.service.ts](../src/features/security/rate-limit/rate-limit.service.ts)
- [src/features/security/rate-limit/decorators/rate-limit.decorator.ts](../src/features/security/rate-limit/decorators/rate-limit.decorator.ts)

`RateLimitGuard` is global but only acts on routes decorated with `@RateLimit()`.

Redis keys use:

```text
rate:limit:{route}:{ip}
```

Current decorated routes:

- Register: 5 requests / 60 seconds.
- Login: 5 requests / 60 seconds.
- Refresh: 20 requests / 60 seconds.
- Change password: 3 requests / 300 seconds.

### Authentication and Authorization Guards

Files:

- [src/features/security/guards/jwt.guard.ts](../src/features/security/guards/jwt.guard.ts)
- [src/features/security/guards/roles.guard.ts](../src/features/security/guards/roles.guard.ts)

`JwtGuard` and `RolesGuard` are global. Authentication is skipped only for `@Public()` routes. Role checks are based on `@Roles()` metadata and the database-loaded user.

### HTTP Headers

File: [src/infrastructure/http/helmet.config.ts](../src/infrastructure/http/helmet.config.ts)

Helmet is enabled with:

- `contentSecurityPolicy: false`
- `crossOriginEmbedderPolicy: false`

### Request Validation

Files:

- [src/infrastructure/http/validation/pipe/validation.constants.ts](../src/infrastructure/http/validation/pipe/validation.constants.ts)
- [src/infrastructure/http/validation/fields](../src/infrastructure/http/validation/fields)
- [src/infrastructure/http/validation/decorators](../src/infrastructure/http/validation/decorators)

The global validation pipe:

- Enables `whitelist`.
- Enables `forbidNonWhitelisted`.
- Enables transformation and implicit conversion.
- Returns HTTP `422` for validation failures.
- Converts validation errors to `AppError`.

### Error Normalization

Files:

- [src/features/security/filters/global-exception.filter.ts](../src/features/security/filters/global-exception.filter.ts)
- [src/core/errors/error-mapper.ts](../src/core/errors/error-mapper.ts)

Known `AppError` instances are returned as structured errors. Unknown errors are mapped to a generic internal error message: `Unexpected error`.

## Device Detection

Files:

- [src/features/security/device-detection](../src/features/security/device-detection)

The application parses the `User-Agent` header and attaches `request.device`. Device data is stored on sessions. A simple trust/risk flag is computed, but it is not currently used to block or challenge requests.

## Security Gaps and Limitations

These items were not found or are incomplete in the current implementation:

- No CORS configuration.
- No audit logging for login, refresh, password change, revocation, or reuse detection.
- No account lockout or per-account failed-login tracking.
- No MFA or second-factor implementation.
- No JWT issuer/audience validation.
- No JWT key rotation or asymmetric signing.
- No refresh-token denylist beyond the active session hash/rotation checks.
- `RedisLockService.acquire()` does not use `NX`, so it is not a strict lock.
- Session revocation endpoints do not clear cookies.
- `UserStatus` exists, but login/authorization does not enforce active/suspended/deactivated status.
- No health/readiness endpoints for deployment security checks.
- No secrets manager integration; secrets are read from environment variables.

## Dependency Security

GitHub Actions include [dependency-review.yml](../.github/workflows/dependency-review.yml), which runs:

- `yarn outdated` with `continue-on-error: true`.
- `yarn npm audit --all`.

Dependabot is configured in [.github/dependabot.yml](../.github/dependabot.yml).
