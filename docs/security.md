# Security

## Overview

Multi-layered security: JWT authentication, permission-based authorization over a three-tier role hierarchy, CSRF double-submit protection, Redis-based rate limiting, device fingerprinting, and Helmet HTTP headers.

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

Access is decided by permissions, not roles. See
[Authorization](authorization.md) for the full model; this section covers the
security-relevant properties only.

### PermissionGuard

`PermissionGuard` (global `APP_GUARD`) reads `@RequirePermissions()` and defers
the decision to `PermissionEvaluationService`, the single place a permission
question is answered.

- No `@RequirePermissions()` → allows all authenticated users, with no database lookup
- Owner → allowed without a lookup
- Anyone else → must hold **every** listed permission
- Grants are read from the database per request, never from JWT claims

### RolesGuard

`RolesGuard` (global `APP_GUARD`) checks `@Roles()` against the caller's tier,
comparing by **rank** so the owner satisfies any tier. It is the fallback for
operations restricted to a tier outright, but no route currently uses it: every
administrator-management route instead declares a normal permission whose
catalog entry is reserved to the owner, so the owner-only rule lives in data
rather than in a controller.

### Roles

| Role | Value | Reach |
|------|-------|-------|
| Owner | `OWNER` | Exactly one; bypasses every authorization check |
| Admin | `ADMIN` | Only what has been granted |
| User | `USER` (default) | Only its own resources |

### Escalation controls

| Attack | Blocked by |
|--------|------------|
| Self-granting | `assertNotSelf` in `loadManageableAdmin` |
| Granting or revoking a permission the caller lacks | `assertCanDelegate` |
| Passing on an owner-reserved permission | rejected by validation (`422`) before any use case runs |
| Creating a second owner | no role input on any endpoint, plus `uq_user_single_owner` |
| Editing, suspending or deleting the owner | `OwnerProtectionPolicy` |
| An administrator minting or inviting administrators | the `ADMIN_*` and `ROLE_ASSIGN` permissions are `ownerOnly` in the catalog, so no one but the owner can ever be evaluated against them |
| Forging or guessing an invitation | 256-bit CSPRNG token, stored only as a SHA-256 digest |

`403 ACCESS_DENIED` carries no metadata: which permission was missing belongs in
the logs, not in a response an attacker can read.

Demotion and deactivation revoke all sessions, because an access token issued
earlier carries the role the account no longer holds.

---

## CSRF Protection

### CsrfGuard

`CsrfGuard` (global `APP_GUARD`) validates CSRF tokens on unsafe HTTP methods (`POST`, `PATCH`, `PUT`, `DELETE`); `GET`, `HEAD`, and `OPTIONS` are always skipped.

Pattern: **Double-submit cookie**
1. On register/login/refresh, server sets a structured `csrf_token` cookie (`nonce.expiresAt.signature`, readable via JavaScript, `httpOnly: false`)
2. Client reads cookie and sends value as `X-CSRF-Token` header on unsafe requests
3. `CsrfValidationService.validate(cookieToken, headerToken, sessionId)` verifies cookie == header (timing-safe), re-validates the HMAC signature and expiry, and checks that a signed token was issued for the current session

### Skip CSRF

Use `@SkipCsrf()` decorator on routes that don't need CSRF (register, login, refresh — which set the CSRF cookie and are unauthenticated). The administrator-invitation accept route is the other exception: its proof is a 256-bit bearer token, so a CSRF token would add nothing.

---

## Rate Limiting

Requests are limited across **several identifiers at once**. A route declares
which dimensions gate it; every rule must pass, and the first denial answers
`429`. Limiting on one dimension alone is bypassable — an attacker rotates
addresses to defeat a per-address limit, or rotates accounts to defeat a
per-account one — so the dimensions are designed to cover each other.

### Declaring a policy

```typescript
@Post('login')
@RateLimit(RateLimitPolicies.Auth.Login)          // address + email + device
async loginUser(@Body() dto: LoginUserRequestDto) { ... }
```

Or an explicit list, to combine rules across groups:

```typescript
@RateLimit({ policies: [
  RateLimitPolicies.Auth.Login.IP,
  RateLimitPolicies.Auth.Login.Email
] })
```

The decorator works at class level too, applying one budget to every route on a
controller (`PriceAlertsController` does this).

### Configuration

Every limit in the application lives in
`src/features/security/rate-limit/config/rate-limit.config.ts`. **No limit or
window may be hardcoded anywhere else.** Changing a value there changes it
application-wide.

Each rule carries:

| Field | Meaning |
|-------|---------|
| `limit` | Requests permitted per window |
| `windowMs` | Length of the fixed window |
| `blockDurationMs` | Temporary block opened when the limit is exceeded; `0` disables |
| `keyPrefix` | Redis key segment |
| `enabled` | Set `false` to take the policy out of service |
| `failOpen` | Behaviour when Redis is unreachable |
| `keyGenerator` | Required for `CUSTOM` rules only |

`as const satisfies RateLimitPolicyTree` makes the tree both type-checked at its
definition site and precisely typed at the call site, so
`RateLimitPolicies.Auth.Login.IP` autocompletes.

### Limits

| Endpoint | Dimensions | Limit / window |
|----------|-----------|----------------|
| `POST /v1/auth/register` | address | 5 / 60s |
| | device | 10 / 60s |
| `POST /v1/auth/login` | address | 5 / 60s |
| | email | 10 / 15m, then blocked 15m |
| | device | 10 / 60s, then blocked 5m |
| `POST /v1/auth/verify-email` | address | 10 / 60s |
| | device | 10 / 60s |
| | email | 5 / 10m |
| | code | 20 / 10m |
| `POST /v1/auth/resend-verification` | address | 5 / 60s |
| | device | 10 / 60s |
| | email | 10 / 1h |
| `POST /v1/auth/refresh` | address, device | 20 / 60s |
| `POST /v1/auth/change-password` | address, user | 3 / 5m |
| `/v1/price-alerts/*` | address, user | 30 / 60s |

Counted imperatively from the use cases rather than by the guard, because the
caller reacts to the outcome instead of returning `429`:

| Policy | Limit / window | Effect |
|--------|---------------|--------|
| `auth.verify.attempts` | 5 / 3m | Invalidates the outstanding code |
| `auth.resend.cooldown` | 1 / 60s | Resend skipped silently |
| `auth.resend.hourly` | 5 / 1h | Resend skipped silently |

Resend limits return `204` rather than `429`: a distinguishable response would
tell a caller which addresses are registered.

### Identifiers

`IP`, `DEVICE`, `USER`, `SESSION`, `EMAIL`, `USERNAME`, `VERIFICATION_CODE`,
`ROUTE`, and `CUSTOM`. Each is owned by one resolver under `resolvers/`, indexed
by a registry — there is no switch. Adding a dimension means adding an enum
member, a resolver, and one entry in the module's provider array; no existing
code changes.

Body-derived dimensions (email, username, code) read the request body **before
the validation pipe has run**, so it is treated as hostile: only a plain object
carrying a genuine string yields a value, and everything else — arrays, numbers,
`{ "$ne": null }` — resolves to `null`.

A `null` resolution **skips** the rule rather than denying it. Denying would
turn every malformed request into a `429` and hand an attacker a way to reject
traffic. The compensating invariant, enforced by a unit test, is that **every
policy group contains at least one dimension that always resolves** (address,
device, or route), so no request is ever unlimited.

### Implementation

One Lua script per decision, so the block check, the increment, the expiry, and
the block write cannot interleave with another client:

```
KEYS  counter, block
ARGV  limit, windowMs, blockDurationMs, cost
      -> { allowed, count, resetAfterMs, blocked }
```

- An active block returns immediately **without touching the counter**, so
  hammering a blocked endpoint cannot extend the block.
- The expiry is attached on the first hit only, so the window never slides.
- Tripping the limit opens the block and drops the counter, so the window
  restarts clean when the block lifts.
- The script never reads a clock. It works in durations from `PTTL`; the
  application converts to an instant via `ClockService`.

Keys are `rl:{prefix}:{identifier}:{hash}` (plus `:blocked`) — for example
`rl:login:ip:9f2c…`, `rl:verify:code:41ab…`. **The identifier is HMAC-SHA256'd
with `SECURITY_HASH_SECRET`, never stored raw**: verification codes carry ~20
bits of entropy and addresses are dictionary-guessable, so a plain digest in a
Redis dump would be reversible by brute force.

Evaluation is **sequential and stops at the first denial**. Consuming the whole
group in parallel would drain the address bucket for a request already rejected
on its email dimension, punishing every co-located user for one attacker.

### Behaviour when Redis is unavailable

Most policies **fail open** — the request is allowed and a
`security.rate_limit.degraded` warning is logged. Policies guarding credentials
and verification codes (`auth.login.*`, `auth.verify.code`) **fail closed** and
return `429`.

> **Operators:** a Redis outage therefore takes login offline. Alert on
> `security.rate_limit.degraded`; it is the only warning before that happens.

### Responses

Rate-limited routes carry `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
`X-RateLimit-Reset`, set on rejections as well as successes. A `429` adds
`Retry-After` and `meta.retryAfter`. **Which policy tripped, and on which
identifier, appears only in the logs** — never in the response.

### Logging

`security.rate_limit.{allowed,hit,blocked,skipped,degraded,exceeded}`. Every
event carries the route, the identifier *type*, a 12-character hash of the
identifier, the remaining budget, and the reset time. The log context type has
no field for a raw value, so an address or a code cannot be logged even by
accident.

### Security properties

| Attack | Why it fails |
|--------|-------------|
| Rotate address against one account | The email dimension is address-independent |
| Rotate account from one address | The address and device dimensions apply regardless of body |
| Rotate address *and* account | The device dimension still binds |
| Fix a code, sweep many accounts | The code dimension is keyed on the code alone and counted separately from the email dimension |
| Brute-force one account's code | The per-user attempt counter invalidates the code after 5 failures |
| Use a Redis outage as a bypass | Credential policies fail closed |
| Reverse identifiers from a Redis dump | Keys are keyed HMACs, not plain digests |
| Extend your own block by hammering | The script returns before touching the counter |

**Known trade-off.** `X-Device-Id` is honoured when it matches
`^[A-Za-z0-9_-]{8,128}$`, so a client that rotates the header lands in a fresh
bucket. The server-derived identifier is always computed alongside it and stored
as `derivedDeviceId`, so the device dimension can be re-pointed at the
unspoofable value without a data migration. Monitor the share of requests
reporting `deviceIdSource: 'header'`.

**Known trade-off.** The per-email block makes an account-lockout nuisance
possible: anyone who knows an address can burn the budget and block it for 15
minutes. The limit is 10 rather than 5, and a successful login resets the
counter, so only failures accumulate.

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
  deviceId?: string;          // handle rate limiting keys on
  derivedDeviceId?: string;   // always the server-derived value
  deviceIdSource?: 'header' | 'derived';
}
```

Used for:
- Session metadata (stored as JSONB on Session entity — the mapper picks the
  four descriptor fields, so the identity fields are not persisted)
- Rate limiting (the device dimension)
- Security logging

### Device identity

`DeviceIdService` resolves a stable per-device handle:

1. **`X-Device-Id` header**, when it matches `^[A-Za-z0-9_-]{8,128}$`. It is
   hashed rather than used verbatim, which bounds the key length and keeps an
   attacker-chosen string out of Redis key space and the logs. A repeated header
   is rejected rather than guessed at.
2. **Otherwise a derived value** — `HMAC(normalized UA | accept-language | IP
   subnet)`. The address is truncated to its network portion (IPv4 `/24`, IPv6
   `/64`, `::ffff:` unwrapped first), so the identifier survives a client hopping
   addresses within its own network but changes when it moves networks.

`derivedDeviceId` is populated in both cases, so the two can be swapped without
a data migration. The header is redacted from request logs.

---

## Password Hashing

### HashingProvider → Argon2Provider (Argon2id)

Abstract hashing interface with an Argon2id implementation that also verifies
legacy bcrypt hashes. See [docs/password-hashing.md](password-hashing.md) for
the full migration story, parameters, and rationale.

| Method | Description |
|--------|-------------|
| `hash(plain: string \| Buffer): Promise<string>` | Argon2id hash (`m=65536, t=3, p=4, l=32`, salt 16 B) |
| `compare(plain: string \| Buffer, hash: string): Promise<boolean>` | Verifies by stored format: Argon2id or legacy bcrypt; unsupported formats rejected |
| `needsMigration(hash: string): boolean` | True for legacy bcrypt hashes awaiting Argon2id upgrade |

Used for:
- Password hashing during registration, password change, and admin invitations
- Automatic bcrypt → Argon2id migration on successful legacy login (conditional
  update, off the request path, failure never blocks login)
- **Not** used for refresh tokens (uses SHA-256 via `RefreshTokenHasher`)
- **Not** used for verification codes (still bcrypt, out of scope — see
  `VerificationCodeService`)

bcrypt remains a dependency only for verifying pre-migration hashes. It
disappears from the database as legacy users log in.

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
- Failed attempts are counted by the `auth.verify.attempts` policy; after 5 wrong codes the current code is invalidated
- Verification is limited on address, device, email (5 per 10 minutes), and the submitted code, so rotating any single one of them cannot bypass the others
- Code re-sends are gated by a 60-second cooldown (`auth.resend.cooldown`) and an hourly limit of 5 per user (`auth.resend.hourly`)
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
