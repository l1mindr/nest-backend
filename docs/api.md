# API

## Versioning

URI-based versioning via `app.enableVersioning()`. All routes use `version: '1'` → prefixed `/v1`.

## Response Shape

### Success

Success responses are returned directly — the resource itself, with no
envelope. Endpoints that communicate through cookies, or through the status
code alone, return no body (`200`/`201`); mutations return `204 No Content`.

```json
{
  "username": "john_doe",
  "role": "USER"
}
```

### Error

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "domain": "USER",
    "message": "User not found",
    "meta": { "userId": "..." },
    "path": "/v1/admin/users/...",
    "timestamp": "2024-01-15T12:00:00.000Z"
  }
}
```

Formatted by `GlobalExceptionFilter`.

---

## Authentication

All routes authenticated by default (`JwtGuard` is global). Use `@Public()` to opt out.

| Method | Path | Auth | CSRF | Rate Limit | Status |
|--------|------|------|------|------------|--------|
| `POST` | `/v1/auth/register` | Public | Skipped | 5/60s | 201 |
| `POST` | `/v1/auth/verify-email` | Public | Skipped | 10/60s | 204 |
| `POST` | `/v1/auth/resend-verification` | Public | Skipped | 5/60s | 204 |
| `POST` | `/v1/auth/login` | Public | Skipped | 5/60s | 200 |
| `POST` | `/v1/auth/refresh` | Public | Skipped | 20/60s | 200 |
| `POST` | `/v1/auth/change-password` | Authenticated | Required | 3/300s | 204 |

### POST /v1/auth/register

Request:
```json
{
  "email": "user@example.com",
  "username": "john_doe",
  "password": "Secure@123"
}
```

Response: `201 Created` — empty body

Errors: `409 EMAIL_ALREADY_EXISTS`, `409 USERNAME_ALREADY_EXISTS`, `422 Validation`

### POST /v1/auth/verify-email

Request:
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

`code`: exactly 6 digits.

Response: `204 No Content`

Errors: `400 INVALID_VERIFICATION_CODE`, `429 RATE_LIMIT_EXCEEDED`

### POST /v1/auth/resend-verification

Request:
```json
{
  "email": "user@example.com"
}
```

Response: `204 No Content` — generic, never reveals whether an account exists.

Errors: `422 Validation`, `429 RATE_LIMIT_EXCEEDED`

### POST /v1/auth/login

Request:
```json
{
  "identifier": "user@example.com",
  "password": "Secure@123"
}
```

Response: `200 OK` — Sets `access_token`, `refresh_token`, `csrf_token` cookies. No body is returned.

Errors: `401 INVALID_CREDENTIALS`, `401 ACCOUNT_NOT_VERIFIED` (unverified user; a new code is sent), `429 RATE_LIMIT_EXCEEDED`

### POST /v1/auth/refresh

Request: No body. Uses `refresh_token` cookie + `X-CSRF-Token` header.

Response: `200 OK` — Rotates both tokens, sets new cookies.

Errors: `401 INVALID_REFRESH_TOKEN`, `401 SESSION_REUSE_DETECTED`, `429 REFRESH_RATE_LIMITED`

### POST /v1/auth/change-password

Request:
```json
{
  "currentPassword": "Old@123",
  "newPassword": "New@456"
}
```

Response: `204 No Content`

---

## Users

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| `GET` | `/v1/user/me` | Authenticated | - | Get current user profile |
| `PUT` | `/v1/user` | Authenticated | Required | Update profile |
| `DELETE` | `/v1/user/delete-account` | Authenticated | Required | Soft delete account |

### GET /v1/user/me

Response: `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "john_doe",
  "name": "John Doe",
  "role": "USER",
  "status": "ACTIVATE",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### PUT /v1/user

Request:
```json
{
  "name": "John Updated"
}
```

Response: `204 No Content`

---

## Sessions

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| `GET` | `/v1/sessions` | Authenticated | - | List active sessions (cursor-paginated) |
| `DELETE` | `/v1/sessions` | Authenticated | Required | Revoke current session (logout) |
| `DELETE` | `/v1/sessions/others` | Authenticated | Required | Revoke all other sessions |

### GET /v1/sessions

Query params: `cursor`, `limit` (default: 20, max: 50)

Response: `200 OK`
```json
{
  "items": [
    {
      "id": "uuid",
      "device": { "browserName": "Chrome", "osName": "macOS", "deviceType": "desktop" },
      "ipAddress": "::1",
      "isCurrent": true,
      "lastUsedAt": "...",
      "createdAt": "..."
    }
  ],
  "currentSession": { "id": "uuid" },
  "nextCursor": "base64string"
}
```

### DELETE /v1/sessions

Response: `204 No Content`

---

## Admin Users

Access is decided by permission, not by role. Holding `ADMIN` grants nothing on
its own; the owner satisfies every requirement without evaluation.

This is the *ordinary user* population only. Administrators and the owner are a
separate population reached through `/v1/admin/administrators`, so neither can
be listed, resolved or suspended through these routes — an administrator or
owner identifier answers the same "not found" as one that was never issued.

| Method | Path | Requires | CSRF | Description |
|--------|------|----------|------|-------------|
| `GET` | `/v1/admin/users` | `USER_READ` | - | List users (cursor-paginated) |
| `GET` | `/v1/admin/users/:id` | `USER_READ` | - | Get user by ID |
| `POST` | `/v1/admin/users/:id/suspend` | `USER_SUSPEND` | Required | Suspend user |
| `PATCH` | `/v1/admin/users/:id/unsuspend` | `USER_UNSUSPEND` | Required | Unsuspend user |

The owner can never be the target of a suspension: it is not in the `USER`
population, so the route misses it the same way it misses an unused identifier.

---

## Administrators & Permissions

Administrator management is **owner-only**: every route below declares a
permission that the catalog marks as reserved to the owner, so no administrator
can ever be granted access to it. Relaxing the restriction later is one flag
per permission in the catalog — no controller or guard changes.

| Method | Path | Requires | CSRF | Description |
|--------|------|----------|------|-------------|
| `GET` | `/v1/admin/administrators` | `ADMIN_READ` | - | List administrators with their grants |
| `GET` | `/v1/admin/administrators/:id` | `ADMIN_READ` | - | Get one administrator |
| `GET` | `/v1/admin/administrators/me` | Session | - | The caller's own administrator profile |
| `PATCH` | `/v1/admin/administrators/:id` | `ADMIN_UPDATE` | Required | Edit an administrator's profile |
| `DELETE` | `/v1/admin/administrators/:id` | `ADMIN_DELETE` | Required | Delete an administrator account |
| `POST` | `/v1/admin/administrators/:id/activate` | `ADMIN_STATUS` | Required | Restore a deactivated administrator |
| `POST` | `/v1/admin/administrators/:id/deactivate` | `ADMIN_STATUS` | Required | Switch off access, revoke sessions |
| `POST` | `/v1/admin/administrators/:id/suspend` | `ADMIN_STATUS` | Required | Suspend an administrator |
| `PATCH` | `/v1/admin/administrators/:id/unsuspend` | `ADMIN_STATUS` | Required | Lift the suspension |
| `POST` | `/v1/admin/administrators/:id/permissions` | `ROLE_ASSIGN` | Required | Grant permissions |
| `DELETE` | `/v1/admin/administrators/:id/permissions` | `ROLE_ASSIGN` | Required | Revoke permissions |
| `GET` | `/v1/admin/permissions` | `ADMIN_READ` | - | The permission catalog |
| `GET` | `/v1/admin/permissions/me` | Session | - | What the caller can do right now |

### Administrator invitations

Administrators are created by invitation, never by promoting an existing
account. No account exists until the invitation is accepted, so a revoked or
lapsed invitation leaves nothing that could be signed into.

| Method | Path | Requires | CSRF | Description |
|--------|------|----------|------|-------------|
| `POST` | `/v1/admin/administrators/invitations` | `ADMIN_INVITE` | Required | Invite an address to become an administrator |
| `GET` | `/v1/admin/administrators/invitations` | `ADMIN_INVITE` | Required | List the invitation log |
| `DELETE` | `/v1/admin/administrators/invitations/:id` | `ADMIN_INVITE` | Required | Revoke a pending invitation |
| `POST` | `/v1/admin/administrators/invitations/accept` | Public | - | Accept an invitation (creates the account) |

### POST /v1/admin/administrators/invitations

Request:

```json
{
  "email": "new.admin@example.com",
  "permissions": ["USER_READ", "USER_SUSPEND"]
}
```

Response: `201 Created` with the pending invitation (never the token).

Errors: `422 EMAIL_ALREADY_EXISTS`, `422` if a permission is owner-reserved.

The token is delivered by email, is single-use, expires after 48 hours, and is
stored only as a SHA-256 digest.

### POST /v1/admin/administrators/invitations/accept

Request:

```json
{
  "token": "the-token-from-the-email",
  "username": "new.admin",
  "password": "Password@123",
  "name": "New Admin"
}
```

Response: `204 No Content`. The account is created with the `ADMIN` role, the
permissions named on the invitation, and an `ACTIVATE` status.

Errors: `404 INVITATION_NOT_FOUND` (unknown token), `409 INVITATION_NOT_PENDING`
(reused or revoked), `410 INVITATION_EXPIRED`.

The email is taken from the invitation, never from the body, and the endpoint
is deliberately public — the token is the entire proof.

### POST /v1/admin/administrators/:id/permissions

Request:

```json
{ "permissions": ["USER_SUSPEND"] }
```

Response: `204 No Content`. Idempotent.

A caller may only pass on permissions they hold themselves, otherwise
`403 PERMISSION_NOT_HELD`. Owner-reserved permissions are rejected by
validation (`422`). Aiming the request at your own account is
`403 SELF_MANAGEMENT_FORBIDDEN`.

### GET /v1/admin/permissions/me

Response: `200 OK`

```json
{
  "role": "ADMIN",
  "permissions": ["USER_READ", "USER_SUSPEND"]
}
```

Open to any authenticated caller and always scoped to the caller. An ordinary
user sees an empty list; the owner sees every permission.

### Visibility rules

- The owner never appears in the user listing, the administrator listing,
  search, pagination or statistics. It is resolvable only by itself.
- An administrator cannot see the administrator directory or resolve a peer:
  `GET /v1/admin/administrators` and `GET .../administrators/:id` are
  owner-reserved. An administrator gets `GET .../administrators/me` instead.
- `GET /v1/admin/users/:id` answers `404` identically for the owner, an
  administrator, and an identifier that was never issued.

---

## Coin Tracker

| Method | Path | Auth | CSRF | Description |
|--------|------|------|------|-------------|
| `GET` | `/v1/coins` | Authenticated | - | List coins (cursor-paginated) |
| `POST` | `/v1/price-alerts` | Authenticated | Required | Create a price alert |
| `GET` | `/v1/price-alerts` | Authenticated | - | List price alerts (cursor-paginated) |
| `PATCH` | `/v1/price-alerts/:id` | Authenticated | Required | Update a price alert |
| `DELETE` | `/v1/price-alerts/:id` | Authenticated | Required | Cancel a price alert |

### GET /v1/coins

Query params:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | - | Filter by name or symbol (case-insensitive) |
| `cursor` | string | - | Pagination cursor |
| `limit` | number | 20 (max 100) | Page size |
| `sortBy` | `id` \| `name` \| `symbol` | `name` | Sort field |
| `sortOrder` | `ASC` \| `DESC` | `ASC` | Sort direction |

Response: `200 OK`
```json
{
  "items": [
    {
      "id": "bitcoin",
      "symbol": "btc",
      "name": "Bitcoin",
      "image": "https://...",
      "isActive": true,
      "lastSyncedAt": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "nextCursor": "base64string"
}
```

### POST /v1/price-alerts

Request:
```json
{
  "coinId": "bitcoin",
  "targetPrice": 120000,
  "direction": "SELL",
  "triggerMode": "ONCE",
  "expiresAt": "2027-01-01T00:00:00Z",
  "notificationChannels": ["EMAIL"]
}
```

`direction`: `BUY` | `SELL`. `triggerMode`: `ONCE` | `REPEAT`. `notificationChannels`: `EMAIL` | `SMS` (non-empty, unique). `expiresAt` must be an ISO-8601 future date (optional).

Response: `201 Created` — the created alert (same shape as the list items below).

Errors: `404 COIN_NOT_FOUND`, `422 Validation`

### GET /v1/price-alerts

Query params: `cursor`, `limit` (default: 20, max: 50), `status` (`ACTIVE` | `TRIGGERED` | `EXPIRED` | `CANCELLED`), `direction` (`BUY` | `SELL`), `coinId`.

Response: `200 OK`
```json
{
  "items": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "coinId": "bitcoin",
      "direction": "SELL",
      "targetPrice": "120000",
      "triggerMode": "ONCE",
      "status": "ACTIVE",
      "expiresAt": "2027-01-01T00:00:00Z",
      "notificationChannels": ["EMAIL"],
      "notificationCooldownMinutes": 60,
      "lastCheckedPrice": null,
      "lastTriggeredAt": null,
      "triggeredCount": 0,
      "coin": { "id": "bitcoin", "symbol": "btc", "name": "Bitcoin" },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "nextCursor": "base64string"
}
```

`targetPrice` and `lastCheckedPrice` are exposed as strings.

### PATCH /v1/price-alerts/:id

Request: any subset of the create fields (`coinId`, `targetPrice`, `direction`, `triggerMode`, `expiresAt`, `notificationChannels`).

Response: `200 OK` — the updated alert.

Errors: `404 PRICE_ALERT_NOT_FOUND`, `422 Validation`

### DELETE /v1/price-alerts/:id

Response: `204 No Content`

Errors: `404 PRICE_ALERT_NOT_FOUND`

---

## Swagger

Available in development mode at `http://localhost:8080/api`.

Swagger decorators are defined in each feature's `presentation/swagger/` directory.

---

## Validation Rules

| Field | Rules |
|-------|-------|
| Email | `IsEmail()`, trimmed, lowercased |
| Username | 3–30 chars, regex `[a-zA-Z0-9._]`, no leading/trailing dots, no consecutive dots, trimmed, lowercased |
| Password | 8–20 chars, requires lowercase + uppercase + digit + non-alphanumeric |
| ID | UUID v4 |
| Verification Code | Exactly 6 digits (`^\d{6}$`) |

Validation errors return `422 UNPROCESSABLE ENTITY` with `VALIDATION_ERROR` domain.

---

## Cookies

| Cookie | Type | HTTP-only | SameSite | Description |
|--------|------|-----------|----------|-------------|
| `access_token` | JWT | Yes | Lax | Bearer token for API access (15 min) |
| `refresh_token` | JWT | Yes | Lax | Token for refresh (7 days) |
| `csrf_token` | `nonce.expiresAt.signature` | No | Lax | CSRF double-submit token |
