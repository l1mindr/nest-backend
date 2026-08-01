# Authentication

## Overview

Cookie-based JWT authentication with server-side session validation, refresh token rotation, and CSRF double-submit protection.

---

## Auth Flow Summary

```
Registration:    POST /v1/auth/register    → 201 Created  (public, rate-limited)
Login:           POST /v1/auth/login       → 200 OK       (public, rate-limited)
Refresh:         POST /v1/auth/refresh     → 200 OK       (public, CSRF skipped, rate-limited)
Change Password: POST /v1/auth/change-password → 204 No Content (authenticated, CSRF required, rate-limited)
```

---

## Registration

### Flow

1. `AuthController.register()` → `RegisterUseCase.execute(dto)`
2. Validates email uniqueness via `UserRepository.findByEmailOrUsername()`
3. Hashes password with `BcryptProvider` (10 rounds)
4. Creates user with status `PENDING_VERIFICATION`
5. Generates a 3-minute verification code (bcrypt-hashed, stored in `UserVerificationCode`)
6. Returns 201

Use case: `RegisterUseCase` (symbol: `REGISTER`)

### DTO

```typescript
class RegisterUserRequestDto {
  @EmailField()
  email: string;

  @UsernameField()
  username: string;

  @PasswordField()
  password: string;
}
```

---

## Email Verification

Verification is an internal flow. There are no public verify-email or resend-verification HTTP routes; the use cases are wired into other flows.

### Flow

1. User receives email with code (via `EmailService.sendVerificationEmail()`)
2. `VERIFY_EMAIL_USE_CASE` loads the latest unexpired code for the user
3. Compares hash (timing-safe via `crypto.timingSafeEqual`)
4. Marks code as verified
5. Changes user status from `PENDING_VERIFICATION` to `ACTIVATE`

### Verification Code

- **TTL**: 3 minutes
- **Storage**: bcrypt hash (plaintext not stored)
- **Entity**: `UserVerificationCode` (userId, codeHash, expiresAt, verifiedAt)
- **Cleanup**: Previous codes are invalidated on new code generation

### Resend

`ResendVerificationUseCase.execute(email)` is invoked internally when a `PENDING_VERIFICATION` user attempts to log in:
- Invalidates previous codes
- Generates new code
- Sends via email
- Login is then rejected with `ACCOUNT_NOT_VERIFIED` (the message notes a new code was sent)

---

## Login

### Flow

1. `AuthController.login()` → `LoginUseCase.login(dto, ipAddress, device)`
2. Finds user by email or username
3. Compares password with `BcryptProvider.compare()`
4. Checks user status:
   - `PENDING_VERIFICATION` → triggers resend of a new verification code, then rejects with `ACCOUNT_NOT_VERIFIED` (401)
   - `SUSPEND` → rejects with `INVALID_CREDENTIALS` (401)
5. Issues session via `SessionIssueUseCase.execute()`
6. Issues access token (15min) + refresh token (7d) via `TokenIssueService`
7. Stores refresh token hash on session
8. Sets cookies via `AuthCookieInterceptor`

### Cookies Set

| Cookie | Type | HTTP-only | SameSite | Max Age |
|--------|------|-----------|----------|---------|
| `access_token` | JWT | Yes | Lax | 15 min |
| `refresh_token` | JWT | Yes | Lax | 7 days |
| `csrf_token` | `nonce.expiresAt.signature` | No | Lax | Session (no `maxAge` set) |

`csrf_token` is a stateless HMAC-SHA256 signature over a random nonce and expiry timestamp; the signature is produced with `CSRF_TOKEN_SECRET`. In production `sameSite` is `strict` (see [Cookie Configuration](#cookie-configuration)).

### Status Enforcement (Login)

| User Status | Login Result |
|-------------|-------------|
| `ACTIVATE` | Allowed |
| `PENDING_VERIFICATION` | 401 `ACCOUNT_NOT_VERIFIED` (new code resent) |
| `SUSPEND` | 401 `INVALID_CREDENTIALS` |

---

## Authenticated Request Flow

1. `JwtGuard` (global) extracts `access_token` cookie
2. `JwtStrategy.authenticate(req)` called
3. `TokenVerificationService.verifyAccess(token)` — verifies JWT signature against access secret
4. `TokenValidationService.validate(payload)` — loads user + session from DB, checks:
   - User exists and is not deleted
   - Session is active and not revoked
   - Session belongs to user
5. Attaches `req.user = { id, role }` and `req.session = { id }`

---

## Refresh

### Flow

1. `AuthController.refresh()` → `RefreshUseCase.refresh(refreshToken)`
2. Acquires Redis lock for session (`refresh:lock:{sessionId}`) — prevents concurrent rotation races
3. Verifies refresh token JWT against refresh secret
4. Loads active session by ID
5. Compares refresh token hash (SHA-256 + timing-safe comparison)
6. Rejects with `SESSION_REUSE_DETECTED` if the session version or hash no longer matches (a reused old token is treated as a leak) and revokes the session
7. Issues new access + refresh token pair
8. **Atomic rotation**: `SessionRotationUseCase.rotateRefreshToken()` — conditional UPDATE on Session:
   ```sql
   UPDATE session
   SET refresh_token_hash = :newHash, version = version + 1,
       rotated_at = :now, last_used_at = :now, expires_at = :newExpiresAt
   WHERE id = :id AND refresh_token_hash = :oldHash AND version = :oldVersion
   ```
9. If 0 rows affected → `SESSION_REUSE_DETECTED`
10. Releases Redis lock
11. Sets new cookies via `AuthCookieInterceptor`

### Rotation Safety

- **Database-level**: Optimistic concurrency via `version` field. Only one winner per refresh.
- **Redis-level**: Lock prevents concurrent rotation attempts on same session.
- **Reuse detection**: If old refresh token is used after rotation, hash mismatch or stale version triggers revocation.

---

## Change Password

### Flow

1. `AuthController.changePassword()` → `ChangePassword.changePassword(userId, sessionId, dto)`
2. Verifies current password; rejects new password identical to current with `PASSWORD_MUST_BE_DIFFERENT`
3. Hashes new password (bcrypt)
4. **Atomic transaction**:
   - `UserRepository.updatePasswordHash(userId, hash, manager)`
   - `SessionRevocationUseCase.terminateOthers(userId, sessionId, manager)` — revokes ALL sessions except current
5. Returns 204

---

## Session Revocation After Suspend

When an admin suspends a user (`POST /v1/admin/users/:id/suspend`):
1. User status changed to `SUSPEND`
2. `SessionRevocationUseCase.revokeAll(userId, manager)` — revokes all sessions
3. **Same transaction** — both updates are atomic
4. User must authenticate again to create a new session

When an admin unsuspends a user (`PATCH /v1/admin/users/:id/unsuspend`):
1. User status changed to `ACTIVATE`
2. Sessions remain revoked (not restored)
3. User must authenticate again

---

## Cookie Configuration

| Environment | `secure` | `sameSite` |
|-------------|----------|------------|
| Production | `true` | `strict` |
| Development | `false` | `lax` |

Path: `/` for all cookies.

---

## Token Specifications

| Token | Algorithm | Secret | TTL | Audience |
|-------|-----------|--------|-----|----------|
| Access | HS256 | `ACCESS_TOKEN_SECRET` | 15 min | `api` |
| Refresh | HS256 | `REFRESH_TOKEN_SECRET` | 7 days | `refresh` |

Separate secrets from environment variables. Symmetric signing (asymmetric key rotation is a known gap).

---

## Error Codes

| Code | Scenario | HTTP |
|------|----------|------|
| `INVALID_CREDENTIALS` | Wrong email/password | 401 |
| `ACCOUNT_NOT_VERIFIED` | PENDING_VERIFICATION user tries to login (code resent) | 401 |
| `INVALID_CURRENT_PASSWORD` | Current password mismatch on change-password | 401 |
| `PASSWORD_MUST_BE_DIFFERENT` | New password identical to current | 401 |
| `PASSWORD_CHANGE_FAILED` | Password change transaction failed | 401 |
| `SESSION_NOT_FOUND` | Session not found during refresh | 401 |
| `SESSION_EXPIRED` | Session expired | 401 |
| `SESSION_REVOKED` | Session revoked | 401 |
| `SESSION_REUSE_DETECTED` | Old refresh token reused | 401 |
| `REFRESH_RATE_LIMITED` | Too many refresh attempts | 429 |
| `INVALID_TOKEN` | JWT signature invalid | 401 |
| `EXPIRED_TOKEN` | JWT expired | 401 |
| `INVALID_REFRESH_TOKEN` | Refresh token invalid or expired | 401 |
| `RATE_LIMIT_EXCEEDED` | Login/register/change-password rate limit hit | 429 |
