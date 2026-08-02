# Security

## Overview

Multi-layered security: JWT authentication, role-based authorization, CSRF double-submit protection, Redis-based rate limiting, device fingerprinting, and Helmet HTTP headers.

---

## Authentication

### JWT Guard

`JwtGuard` (global `APP_GUARD`) validates the `access_token` cookie on every request.

Flow:
1. Extract `access_token` from cookies
2. Verify JWT signature via `TokenVerificationService.verifyAccess()`
3. Validate payload against database via `TokenValidationService.validate()`:
   - User exists and is not soft-deleted
   - Session is active and not revoked
   - Session belongs to user
4. Attach `req.user` and `req.session`

Use `@Public()` decorator to bypass authentication on specific routes.

### JWT Strategy

`JwtStrategy` encapsulates the `authenticate(req)` method called by `JwtGuard`. This is not a Passport strategy — it's a custom implementation that decodes and validates cookies directly.

### Token Services

| Service | Responsibility |
|---------|---------------|
| `TokenIssueService` | Signs access (15min, audience `api`) and refresh (7d, audience `refresh`) JWTs with separate secrets |
| `TokenVerificationService` | Verifies JWT signatures against access/refresh secrets |
| `TokenValidationService` | Validates payload against database (user + session existence + state) |

### Secrets

Two separate environment variables:
- `ACCESS_TOKEN_SECRET` — used for access token signing
- `REFRESH_TOKEN_SECRET` — used for refresh token signing

Both are symmetric HS256 (asymmetric key rotation is a known gap).

---

## Authorization

### RolesGuard

`RolesGuard` (global `APP_GUARD`) checks the `@Roles()` decorator metadata against `request.user.role`.

- No `@Roles()` → allows all authenticated users
- `@Roles(UserRole.ADMIN)` → restricts to admin users only
- Role is loaded from database (not from JWT claims)

### Roles

| Role | Value |
|------|-------|
| User | `USER` (default) |
| Admin | `ADMIN` |

### Admin Endpoints

Protected by `@Roles(UserRole.ADMIN)` on the controller class:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/admin/users` | List users (cursor-paginated) |
| `GET` | `/v1/admin/users/:id` | Get user by ID |
| `POST` | `/v1/admin/users/:id/suspend` | Suspend user |
| `PATCH` | `/v1/admin/users/:id/unsuspend` | Unsuspend user |

---

## CSRF Protection

### CsrfGuard

`CsrfGuard` (global `APP_GUARD`) validates CSRF tokens on unsafe HTTP methods (`POST`, `PATCH`, `PUT`, `DELETE`); `GET`, `HEAD`, and `OPTIONS` are always skipped.

Pattern: **Double-submit cookie**
1. On register/login/refresh, server sets a structured `csrf_token` cookie (`nonce.expiresAt.signature`, readable via JavaScript, `httpOnly: false`)
2. Client reads cookie and sends value as `X-CSRF-Token` header on unsafe requests
3. `CsrfValidationService.validate(cookieToken, headerToken, sessionId)` verifies cookie == header (timing-safe), re-validates the HMAC signature and expiry, and checks that a signed token was issued for the current session

### Skip CSRF

Use `@SkipCsrf()` decorator on routes that don't need CSRF (register, login, refresh — which set the CSRF cookie and are unauthenticated).

---

## Rate Limiting

### RateLimitGuard

Applied via `@RateLimit({ limit, ttl })` decorator on individual routes.

### Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /v1/auth/register` | 5 | 60s |
| `POST /v1/auth/login` | 5 | 60s |
| `POST /v1/auth/refresh` | 20 | 60s |
| `POST /v1/auth/change-password` | 3 | 300s |

### Implementation

`RateLimitCounterService.increment(key)` uses a Lua script on Redis:
- `INCR` the key
- Set TTL on first increment
- Return current count

Keys: `rate:limit:{route}:{ip}`

---

## Device Detection

### DeviceMiddleware

Global middleware that runs on every request. Parses the `User-Agent` header using `ua-parser-js` and attaches `req.device`.

### DeviceContext

```typescript
interface DeviceContext {
  browserName: string;
  browserVersion: string;
  osName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  fingerprintRisk?: 'low' | 'medium' | 'high';
}
```

Used for:
- Session metadata (stored as JSONB on Session entity)
- Security logging

---

## Password Hashing

### HashingProvider → BcryptProvider

Abstract hashing interface with bcrypt implementation:

| Method | Description |
|--------|-------------|
| `hash(plain: string): Promise<string>` | Hash with 10 salt rounds |
| `compare(plain: string, hash: string): Promise<boolean>` | Timing-safe comparison |

Used for:
- Password hashing during registration and password change
- **Not** used for refresh tokens (uses SHA-256 via `RefreshTokenHasher`)

---

## Refresh Token Hashing

### RefreshTokenHasher

SHA-256 hashing for refresh token storage:
- `hash(token: string): string` — SHA-256 hex digest
- `compare(token: string, hash: string): boolean` — Timing-safe comparison

Refresh tokens are stored as SHA-256 hashes in the Session entity. The raw token is only available in the JWT cookie and is never persisted.

---

## Email Verification

`UserVerificationCode` entity stores verification codes as bcrypt hashes with 3-minute TTL. Codes are sent via `EmailService.sendVerificationEmail()` over SMTP (Nodemailer).

Brute-force hardening:
- Failed attempts are counted in Redis (`verify:attempts:{userId}`); after 5 wrong codes the current code is invalidated
- Verification attempts are rate-limited per normalized email (`verify:email:{email}`, 5 per 10 minutes) in addition to the per-IP guard, so rotating IPs cannot bypass it
- Code re-sends are gated by a 60-second cooldown (`verify:resend:cooldown:{userId}`) and an hourly limit of 5 per user (`verify:resend:hourly:{userId}`)
- All failures return the generic `INVALID_VERIFICATION_CODE` — wrong, consumed, and expired codes are indistinguishable
- Codes are compared with `crypto.timingSafeEqual` and never logged

---

## HTTP Security Headers

Configured via Helmet in `bootstrap.ts`:

| Header | Setting |
|--------|---------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-XSS-Protection` | `0` |
| `Strict-Transport-Security` | Enabled (production) |
| `Content-Security-Policy` | Disabled |
| `Cross-Origin-Embedder-Policy` | Disabled |

---

## Session Revocation

Sessions are revoked on:
- Suspend — all sessions revoked atomically with status change
- Password change — all other sessions revoked atomically with password update
- Logout — current session revoked
- Max session limit exceeded — oldest sessions revoked

Revoked sessions are marked `isRevoked = true`. They remain in the database for audit purposes but are excluded from active session queries.

---

## Known Security Gaps

- No JWT issuer/audience validation beyond custom audience claim
- Symmetric signing only (no key rotation, no asymmetric keys)
- Redis lock for refresh uses `SET key token EX ttl NX` and release via Lua compare-and-delete; the database conditional update remains the authoritative mechanism
- No account lockout after failed login attempts
- No multi-factor authentication
- No CORS configuration
- No audit log table (relies on pino structured logging only)
- Revocation does not clear cookies client-side
