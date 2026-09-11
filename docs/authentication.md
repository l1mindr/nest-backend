# Authentication

## Overview

Cookie-based JWT authentication with server-side session validation, refresh token rotation, and CSRF double-submit protection.

---

## Token lifetimes

| Token | Lifetime | Cookie |
|-------|----------|--------|
| `access_token` | **15 minutes** | HttpOnly, rotated on every refresh |
| `refresh_token` | **7 days** | HttpOnly, single-use, rotated on every refresh |

Both are intentional. The 15-minute access token is short **by design**: it
bounds the damage of a leaked token while the 7-day refresh token keeps the user
signed in. Any "user gets logged out too often" report is a bug in a refresh
path, not a reason to lengthen the access token.

Refresh **preserves the session id** and rotates only the refresh-token hash, so
the session-bound CSRF token stays valid across a refresh.

Consumers must therefore be able to refresh:

- **Browser** — `lib/auth/refresh-manager.ts` in the frontend, single-flight so
  concurrent 401s produce exactly one `POST /v1/auth/refresh`.
- **Server-side rendering** — `src/proxy.ts` in the frontend refreshes before
  deciding whether a request is authenticated, and forwards the resulting
  `Set-Cookie` headers. Without that, a hard navigation more than 15 minutes
  after the last request redirected a perfectly valid session to the login page.

Both are deduplicated because presenting an already-consumed refresh token is
treated as theft: `Refresh` compares against the stored hash and, on mismatch,
revokes the whole session with `SESSION_REUSE_DETECTED`. The backend's Redis
lock (`RedisKey.REFRESH_LOCK`) serializes concurrent attempts across processes.

---

## Auth Flow Summary

```
Registration:    POST /v1/auth/register           → 201 Created  (public, rate-limited)
Email Verify:    POST /v1/auth/verify-email       → 204 No Content (public, rate-limited)
Resend Code:     POST /v1/auth/resend-verification → 204 No Content (public, rate-limited)
Login:           POST /v1/auth/login              → 200 OK, NO BODY (public, rate-limited)
Logout:          DELETE /v1/sessions              → 204, revokes + clears all auth cookies
Refresh:         POST /v1/auth/refresh            → 200 OK       (public, CSRF skipped, rate-limited)
Change Password: POST /v1/auth/change-password    → 204 No Content (authenticated, CSRF required, rate-limited)
```

---

## Registration

### Flow

1. `AuthController.register()` → `RegisterUseCase.execute(dto)`
2. Validates email uniqueness via `UserRepository.findByEmailOrUsername()`
3. Hashes password with `HashingProvider` (Argon2id)
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

New accounts are registered with status `PENDING_VERIFICATION` and can only log in after their email is verified. The flow exposes two public, rate-limited endpoints.

### Flow

1. User receives email with code (via `EmailService.sendVerificationEmail()`)
2. `POST /v1/auth/verify-email` with `{ email, code }` → `VerifyEmailUseCase.execute()`
3. Loads the latest unexpired code for the user (`findLatestByUserId`, filters `verifiedAt IS NULL`)
4. Compares hash (timing-safe via `crypto.timingSafeEqual`)
5. Marks code as verified (`markVerified`)
6. Changes user status from `PENDING_VERIFICATION` to `ACTIVATE`
7. Responds `204 No Content` — the handler is declared `@HttpCode(HttpStatus.NO_CONTENT)`
   and returns no body. `POST /v1/auth/resend-verification` is likewise `204`.

### Verification Code

- **TTL**: 3 minutes
- **Storage**: bcrypt hash (plaintext not stored) — a separate concern from
  passwords; see [password-hashing.md](password-hashing.md)
- **Entity**: `UserVerificationCode` (userId, codeHash, expiresAt, verifiedAt)
- **Cleanup**: Previous codes are invalidated on new code generation

### Attempt Limiting

Failed attempts are counted through the rate limit framework (`auth.verify.attempts`, keyed per user, window matching the code lifetime):

- Each wrong code increments the counter and returns `400 INVALID_VERIFICATION_CODE`
- After 5 failed attempts the current code is invalidated and the counter resets; a new code must be requested
- All failures return the generic `400 INVALID_VERIFICATION_CODE` (wrong, consumed, or expired) to avoid leaking account state
- Verification is rate-limited on address, device, normalized email (5 per 10 minutes), and the submitted code itself, applied by the guard before the request reaches the use case (`429 RATE_LIMIT_EXCEEDED`). See [security.md](security.md#rate-limiting)

### Resend

`POST /v1/auth/resend-verification` with `{ email }` → `ResendVerificationUseCase.execute()`:

- Applies to `PENDING_VERIFICATION` accounts only
- Enforces a **60-second cooldown** per user (`auth.resend.cooldown`, a one-per-window policy)
- Enforces an **hourly limit** of 5 resends per user (`auth.resend.hourly`)
- Invalidates previous codes and resets the failed-attempt counter
- Generates new code and sends via email
- The response is **generic** (`204 No Content`) and never reveals whether an account exists

Resend is also triggered internally when a `PENDING_VERIFICATION` user attempts to log in; login is then rejected with `403 ACCOUNT_NOT_VERIFIED` (the message notes a new code was sent).

### Email Delivery

Emails are sent over SMTP (Gmail) via `SmtpEmailService` (Nodemailer). Delivery failures are logged (`EMAIL_SEND_FAILED`) but do not fail the request — the user record and hashed code persist, so the code can be re-sent via the resend endpoint.

---

## Login

### Flow

1. `AuthController.login()` → `LoginUseCase.login(dto, ipAddress, device)`
2. Finds user by email or username
3. Compares password with `HashingProvider.compare()` (verifies Argon2id hashes,
   and legacy bcrypt hashes) — the password hash is **never** compared with
   `===`; verification goes through the provider
4. On a successful **legacy bcrypt** login, rehashes the password with Argon2id
   in the background (conditional update — safe under concurrent logins);
   migration failure never fails the login. See
   [password-hashing.md](password-hashing.md#legacy-bcrypt-support-and-automatic-migration)
5. Checks user status:
   - `PENDING_VERIFICATION` → triggers resend of a new verification code, then rejects with `ACCOUNT_NOT_VERIFIED` (403)
   - `SUSPEND` → rejects with `INVALID_CREDENTIALS` (401)
6. Issues session via `SessionIssueUseCase.execute()`
7. Issues access token (15min) + refresh token (7d) via `TokenIssueService`
8. Stores refresh token hash on session
9. Sets cookies via `AuthCookieInterceptor`

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
| `PENDING_VERIFICATION` | 403 `ACCOUNT_NOT_VERIFIED` (new code resent) |
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
6. On mismatch, consults the **rotation grace window** (below). A hit returns the pair the winning request already received and stops here — no rotation, no revocation. A miss is treated as a leak: `SESSION_REUSE_DETECTED` and the session is revoked
7. Issues new access + refresh token pair
8. **Atomic rotation**: `SessionRotationUseCase.rotateRefreshToken()` — conditional UPDATE on Session:
   ```sql
   UPDATE session
   SET refresh_token_hash = :newHash, version = version + 1,
       rotated_at = :now, last_used_at = :now, expires_at = :newExpiresAt
   WHERE id = :id AND refresh_token_hash = :oldHash AND version = :oldVersion
   ```
9. If 0 rows affected → `409 REFRESH_ROTATION_CONFLICT` (below). **Not** reuse: the presented token matched the stored hash at step 5, so this is a lost race, not a replay. The session is left active and the cookie is left in place
10. Releases Redis lock
11. Sets new cookies via `AuthCookieInterceptor`

### Rotation Safety

- **Database-level**: Optimistic concurrency via `version` field. Only one winner per refresh.
- **Redis-level**: Lock prevents concurrent rotation attempts on same session.
- **Reuse detection**: If an old refresh token is used after rotation, the hash mismatch at step 5 triggers revocation — subject to the grace window below.

### Rotation Conflict (`409 REFRESH_ROTATION_CONFLICT`)

The Redis lock is held for five seconds. A request still in flight when it
lapses no longer excludes anyone, so a second refresh can acquire the lock and
commit its rotation between the first request's read (step 4) and its
compare-and-swap write (step 8). The first request's `UPDATE` then matches no
rows.

That used to raise `SESSION_REUSE_DETECTED`, which is the wrong claim twice
over: the token *was* current when it was compared, and the 401 that carried it
is read by the frontend as a dead session — so a millisecond of bad luck signed
the user out. It answers `409` instead:

| | Replay | Rotation conflict |
|---|---|---|
| Signal | Presented hash ≠ stored hash, and no grace record | `affected = 0` on the optimistic write |
| Token at compare time | Already spent | Current |
| Session | **Revoked** | Untouched |
| `refresh_token` cookie | Cleared | Left in place |
| Response | `401 SESSION_REUSE_DETECTED` | `409 REFRESH_ROTATION_CONFLICT` |
| Log event | `auth.refresh.reuse_detected` (error) | `auth.refresh.rotation_conflict` (warn) |
| Client | Log in again | Retry, bounded |

The conflict is reported only after the winner has committed, so a retry meets a
settled session: it either presents the new token or resolves through the grace
window below. `refresh-manager.ts` in the frontend makes at most one such retry
per refresh, with no delay.

### Rotation Grace Window

Rotation is single-use, so the instant `R1` becomes `R2` any request still
holding `R1` fails the hash comparison. That is the correct answer for a stolen
token and the wrong one for a race this system creates on purpose: the Next.js
proxy refreshes server-side while the browser's own single-flight refresh may
already be in flight, and the two processes share a cookie jar but no in-memory
state. Legitimate users were being logged out for a race they did not cause.

`RefreshReplayService` (`features/auth/application/services`) records, for
**10 seconds** after each rotation, the pair the consumed token rotated into —
keyed by that token's SHA-256 digest under
`refresh:replay:{sessionId}:{hash}`, never by the token itself. A racing
request presenting the previous token inside that window is handed back
*exactly* the winner's pair: one logical rotation, no second lineage.

What keeps it from becoming a multi-use refresh token:

| Bound | Mechanism |
|---|---|
| One generation only | The record stores the session `version` its token was valid at; a hit requires `record.version === session.version - 1`. Two generations back is refused. |
| Time bounded | Redis TTL, set once at write time. Serving a record never extends it. |
| Session scoped | The key is namespaced by session id, so a record can only resolve a refresh for the session that created it. |
| Not configurable | The window is a constant, deliberately not an environment variable — the security argument rests on it staying short. |

The distinction to hold onto:

- **Legitimate near-simultaneous rotation** → tolerated within the bounded
  grace, logged as `auth.refresh.rotation_raced`.
- **Actual old-token replay** (outside the window, or from an older
  generation) → `SESSION_REUSE_DETECTED`, session revoked, logged as
  `auth.refresh.reuse_detected`. Unchanged.

The stored value is a bearer-token pair at rest for those seconds. Redis is
already the trust-boundary store for session locks and rate-limit counters, and
the exposure is bounded by the same TTL; it is the price of returning the
winner's exact result rather than minting a second token lineage, which is what
would actually be unsafe.

Covered by `refresh.use-case.spec.ts` (normal rotation, tolerated race, expired
grace, two-generations-back replay, cross-session isolation, refresh storm) and
`test/v1/auth-refresh-v1.e2e-spec.ts` against the real stack.

---

## Change Password

### Flow

1. `AuthController.changePassword()` → `ChangePassword.changePassword(userId, sessionId, dto)`
2. Verifies current password; rejects new password identical to current with `PASSWORD_MUST_BE_DIFFERENT`
3. Hashes new password (Argon2id)
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

### Cookie Domain and production topology

By default the auth cookies are **host-only**: no `Domain` attribute, so a
cookie set by `api.your-domain.com` is sent to that host and nowhere else.

That is correct on localhost and in Docker, where one host (`localhost`) serves
both the frontend and the API and the port plays no part in cookie scope. It is
**wrong for the production `app.` / `api.` split**, where two consumers live on
the frontend host and can see nothing:

- `proxy.ts` reads `access_token` from the request to `app.your-domain.com` for
  the SSR auth gate;
- `lib/api/client.ts` reads `csrf_token` via `document.cookie` on that origin to
  build the `X-CSRF-Token` double-submit header.

Host-only cookies leave both blind, so login succeeds and the next navigation
redirects to `/auth/login`, while every unsafe request fails CSRF. Neither the
mocked nor the localhost integration lane can catch this — same host, shared
cookie, bug invisible.

`COOKIE_DOMAIN` supplies the missing attribute:

```bash
COOKIE_DOMAIN=.your-domain.com
```

`baseAuthCookieOptions()` reads it, so the writer (`AuthCookieService`) and the
clearer (`ClearAuthCookiesInterceptor`) pick it up together — which matters,
because a browser only deletes a cookie when the clearing `Set-Cookie` repeats
the same `Domain`, `Path`, `Secure` and `SameSite`. That pairing is pinned by
`auth-cookie.parity.spec.ts`.

`SameSite=strict` stays as it is: `app.` and `api.` are the *same site*, so
strict permits their XHR. Only a genuinely cross-site split (a different
registrable domain) would need `none`, which is a deployment decision.

**Do not set `COOKIE_DOMAIN` unless every host under the parent domain is
trusted and operated by you.** A domain cookie is sent to *every* subdomain, and
`HttpOnly` does not protect it there — any server under the domain reads
`access_token` and `refresh_token` straight from the `Cookie` header. It is
unsafe when subdomain takeover is possible (dangling CNAME/A records), when any
subdomain is third-party hosted (status page, docs, marketing, CI previews),
when wildcard DNS points at shared infrastructure, or when any sibling
subdomain serves untrusted content. If you cannot guarantee all of that, serve
the API under the app's own origin via an edge proxy and leave cookies
host-only. Setting a `Domain` also rules out the `__Host-` prefix, which is
defined as forbidding it.

**Rollout.** Browsers already holding host-only cookies keep them alongside the
new domain-scoped ones until they expire on their own — 15 minutes for
`access_token`, 7 days for `refresh_token`. No migration step is required.
Logout clears the domain-scoped cookies. If the overlap ever needs to be cut
short, a future change can clear both scopes explicitly for one release.

Reproduced locally by the distinct-host lane,
`next-dashboard-frontend/playwright.topology.config.ts`, which serves the app
and API from `app.localtest.me` / `api.localtest.me` under
`COOKIE_DOMAIN=.localtest.me`.

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
| `ACCOUNT_NOT_VERIFIED` | PENDING_VERIFICATION user tries to login (code resent) | 403 |
| `INVALID_VERIFICATION_CODE` | Wrong, consumed, or expired verification code | 400 |
| `INVALID_CURRENT_PASSWORD` | Current password mismatch on change-password | 401 |
| `PASSWORD_MUST_BE_DIFFERENT` | New password identical to current | 401 |
| `PASSWORD_CHANGE_FAILED` | Password change transaction failed | 401 |
| `SESSION_NOT_FOUND` | Session not found during refresh | 401 |
| `SESSION_EXPIRED` | Session expired | 401 |
| `SESSION_REVOKED` | Session revoked | 401 |
| `SESSION_REUSE_DETECTED` | Old refresh token reused | 401 |
| `REFRESH_ROTATION_CONFLICT` | Another request rotated this session first; retryable, session kept | 409 |
| `REFRESH_RATE_LIMITED` | Too many refresh attempts | 429 |
| `INVALID_TOKEN` | JWT signature invalid | 401 |
| `EXPIRED_TOKEN` | JWT expired | 401 |
| `INVALID_REFRESH_TOKEN` | Refresh token invalid or expired | 401 |
| `RATE_LIMIT_EXCEEDED` | Login/register/verify/resend/change-password rate limit hit | 429 |
