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
  "email": "user@example.com",
  "password": "Secure@123"
}
```

The field is named `email` but accepts an email address **or** a username
(`LoginUserRequestDto.email`).

Response: `200 OK` — Sets `access_token`, `refresh_token`, `csrf_token` cookies. No body is returned.

Errors: `401 INVALID_CREDENTIALS`, `401 ACCOUNT_NOT_VERIFIED` (unverified user; a new code is sent), `429 RATE_LIMIT_EXCEEDED`

### POST /v1/auth/refresh

Request: No body. Uses `refresh_token` cookie + `X-CSRF-Token` header.

Response: `200 OK` — Rotates both tokens, sets new cookies.

Errors: `401 INVALID_REFRESH_TOKEN`, `401 SESSION_REUSE_DETECTED`, `409 REFRESH_ROTATION_CONFLICT` (retryable — another request rotated first; the session and the cookie are kept), `429 REFRESH_RATE_LIMITED`

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

Response: `200 OK` — `UserProfileResponseDto`, serialized `@Expose()`-only:

```json
{
  "name": "John Doe",
  "username": "john_doe",
  "email": "user@example.com",
  "role": "USER",
  "joinedAt": "2026-08-02T14:35:00.000Z"
}
```

Exactly those five fields. In particular the caller's own `id` is **not** exposed,
and there is no `status`/`createdAt`/`updatedAt`: the entity keeps its timestamps
in the embedded `registryDates`, and the creation instant is surfaced as
`joinedAt`. `name` is `null` until the user sets one through `PUT /v1/user`.

There is no phone/mobile field anywhere on this entity or DTO.

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
| `DELETE` | `/v1/sessions/:sessionId` | Authenticated | Required | Revoke one other session |

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

### DELETE /v1/sessions/:sessionId

Signs one other device out, addressed by the `sessionId` from `GET /v1/sessions`.
The calling session is untouched and its cookies stay valid.

Scoped to the caller. The lookup runs before the revocation, so an id that is
unknown, already revoked, expired, or owned by another account all return the
same `404 SESSION_NOT_FOUND` — a stale list cannot report a device as signed out
twice, and the route leaks nothing about other accounts.

The current session is refused with `409 SESSION_IS_CURRENT`. Ending it is a
logout, and `DELETE /v1/sessions` is the route for that because it also clears
the auth cookies; revoking it here would leave the browser holding credentials
the server had already invalidated.

Declared after `/others` so the literal segment is matched first.

Response: `204 No Content`

### DELETE /v1/sessions

Logout. Revokes the session server-side **and** clears all three auth cookies
(`access_token`, `refresh_token`, `csrf_token`) via `ClearAuthCookiesInterceptor`.

Previously only `csrf_token` was cleared, so the browser kept presenting dead
`access_token`/`refresh_token` cookies until they expired (15 minutes / 7 days).
That was never an access-control hole — `TokenValidationService` re-checks
session liveness on every request — but each subsequent call paid a full
401 → refresh → 401 round trip before the client concluded the session was gone.

The cookies are cleared only when the revocation itself succeeds, so a failed
logout never leaves the browser without credentials for a session that is still
alive.

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

> **Notification channels.** `NotificationChannel` has two members, but only
> `EMAIL` is deliverable. `SMS` has no transport anywhere in the project —
> `EmailNotificationService.sendSms` records the request and drops it — so
> `POST` and `PATCH` reject it with `422 VALIDATION_ERROR` and
> `meta.field = "notificationChannels"` (`SupportedNotificationChannelValidator`,
> applied per element). The member stays in the enum because
> `notificationChannels` is a PostgreSQL enum array and alerts created before
> this restriction may still carry it; those alerts keep working, with their
> EMAIL channel delivering and the SMS one logged and dropped. The single source
> of truth is `SUPPORTED_NOTIFICATION_CHANNELS`.
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

## Portfolios

Five controllers back this feature. Note the route layout: **holdings are a top-level
collection filtered by `portfolioId`**, while transactions, P&L and opening balances are
**nested** under their portfolio.

Every route is authenticated and scoped to the caller — each use case resolves the
portfolio through `findByIdAndUser(portfolioId, userId)` before doing any work, so another
user's id yields `404 PORTFOLIO_NOT_FOUND` rather than a 403.

| Method | Path | CSRF | Status | Description |
|--------|------|------|--------|-------------|
| `POST` | `/v1/portfolios` | Required | 201 | Create a portfolio |
| `GET` | `/v1/portfolios` | - | 200 | List the caller's portfolios (**bare array**, not paginated) |
| `GET` | `/v1/portfolios/:id` | - | 200 | One portfolio |
| `PATCH` | `/v1/portfolios/:id` | Required | 200 | Partial update; `{}` → `PORTFOLIO_EMPTY_UPDATE` |
| `DELETE` | `/v1/portfolios/:id` | Required | 204 | Hard delete; cascades to holdings, transactions and calculation checkpoints |
| `GET` | `/v1/portfolios/:id/valuation` | - | 200 | Current value, priced from ledger-derived holdings |
| `GET` | `/v1/portfolios/:portfolioId/pnl` | - | 200 | Realized/unrealized P&L from the transaction ledger |

### PortfolioResponseDto

`{ id, name, sourceType, walletAddress, createdAt, updatedAt }`

`sourceType` ∈ `LEDGER | EXCHANGE | WALLET | OTHER`. The portfolio record deliberately
carries **no** totals — value lives only on the valuation and P&L sub-resources.

### GET /v1/portfolios/:id/valuation

```json
{
  "portfolioId": "...", "currency": "USD",
  "totalValue": "60000.5",
  "status": "COMPLETE",
  "valuedHoldings": 2, "unvaluedHoldings": 0,
  "pricedAt": "2026-08-02T14:35:00.000Z",
  "holdings": [{ "holdingId": "...", "assetId": "...", "symbol": "btc",
                 "name": "Bitcoin", "amount": "0.5",
                 "currentPrice": "96785.25", "value": "48392.625" }]
}
```

`status` ∈ `COMPLETE | PARTIAL | UNAVAILABLE | EMPTY`. `totalValue`, `currentPrice` and
`value` are `null` when no price is available. Holdings that net to zero are excluded.

Prices come from `asset.currentPrice`, which the **hourly** asset-sync job maintains — not
from the live `/v1/market/*` tickers.

`pricedAt` (ISO-8601, nullable) reports when the **oldest** price contributing to
this valuation was last synchronised, making it a freshness floor: the valuation
is at least that fresh, never less. It is `null` when nothing could be priced.
Clients should present the age rather than implying the total is live — without
it, a dashboard shows an hour-old portfolio total beside a 30-second-old BTC
price with nothing to tell them apart.

It is deliberately a timestamp rather than an `isStale` boolean: the threshold at
which an hourly price becomes stale depends on `ASSET_SYNC_INTERVAL`, which is
deployment configuration, so the API reports the instant and leaves the policy to
the client.

### GET /v1/portfolios/:portfolioId/pnl

| Param | Type | Default |
|-------|------|---------|
| `costBasis` | `AVERAGE` \| `FIFO` \| `LIFO` | `AVERAGE` |

```json
{
  "portfolioId": "...", "currency": "USD", "costBasis": "AVERAGE",
  "pricedPositions": 2, "unpricedPositions": 0,
  "totalCurrentValue": "96000", "totalCostBasis": "85000",
  "totalRealizedPnl": "5000", "totalUnrealizedPnl": "6000", "totalPnl": "11000",
  "positions": [{
    "assetId": "...", "symbol": "btc", "name": "Bitcoin",
    "quantity": "1.5", "totalCost": "85000", "averageCost": "56666.666666666666666666666666",
    "currentPrice": "60000.00000000", "currentValue": "90000",
    "realizedPnl": "5000", "unrealizedPnl": "5000", "totalPnl": "10000",
    "realizedPnlEvents": [{
      "transactionId": "...", "occurredAt": "...", "type": "SELL",
      "amount": "0.5", "price": "60000", "proceeds": "30000",
      "releasedCostBasis": "25000", "realizedPnl": "5000", "fee": "10"
    }]
  }]
}
```

Every monetary and quantity value is a **decimal string**. Fields that can have no price are
nullable. Results are memoized in calculation checkpoints, which any transaction write
invalidates under a `(portfolioId, assetId)` advisory lock.

Errors: `404 PORTFOLIO_NOT_FOUND`

---

## Holdings

| Method | Path | CSRF | Status | Description |
|--------|------|------|--------|-------------|
| `GET` | `/v1/holdings?portfolioId=` | - | 200 | Holdings **derived from the transaction ledger** |
| `POST` | `/v1/holdings` | Required | 201 | Create a stored holding row |
| `PATCH` | `/v1/holdings/:id` | Required | 200 | Update `amount` / `notes` |
| `DELETE` | `/v1/holdings/:id` | Required | 204 | Delete a stored holding row |

> **Read and write use different sources.** `ListHoldingsUseCase` and
> `GetPortfolioValuationUseCase` both compute holdings from the transaction ledger via
> `HoldingsService` and deliberately never read the `holding` table, so the numbers always
> agree with valuation and with the oversell check. The `POST`/`PATCH`/`DELETE` routes still
> write that table, which nothing reads — they are **vestigial** and should not be used by
> new clients. `GET` also returns a *synthesized* `id` (`derivedHoldingId(portfolioId,
> assetId)`), stable across requests but corresponding to no row, so ids from the list are
> not usable with `PATCH`/`DELETE`.

Response: `{ items: HoldingResponseDto[], nextCursor: null }`. Each item is
`{ id, portfolioId, assetId, amount, notes, asset, createdAt, updatedAt }`, where `asset` is
the full `AssetResponseDto`. Positions that net to zero are omitted. `portfolioId` is an
optional filter — without it, every portfolio the caller owns is derived.

---

## Portfolio Transactions

The transaction ledger is the source of truth for holdings, valuation and P&L.

| Method | Path | CSRF | Status |
|--------|------|------|--------|
| `POST` | `/v1/portfolios/:portfolioId/transactions` | Required | 201 |
| `GET` | `/v1/portfolios/:portfolioId/transactions` | - | 200 |
| `GET` | `/v1/portfolios/:portfolioId/transactions/:id` | - | 200 |
| `PATCH` | `/v1/portfolios/:portfolioId/transactions/:id` | Required | 200 |
| `DELETE` | `/v1/portfolios/:portfolioId/transactions/:id` | Required | 204 |

### POST — request

```json
{
  "assetId": "uuid", "type": "BUY", "amount": "0.5",
  "price": "60000.50", "fee": "0.75", "priceCurrency": "USD",
  "occurredAt": "2026-08-02T14:35:00.000Z", "notes": null,
  "destinationType": null, "exchangeName": null, "txid": null, "walletId": null
}
```

| Field | Rules |
|-------|-------|
| `amount` | decimal string, ≤ 18 fraction digits, **must be > 0** |
| `price` | decimal string, ≤ 8 fraction digits. **Required for `BUY`/`SELL`**, dropped otherwise |
| `fee` | decimal string, ≤ 8 fraction digits, zero allowed |
| `priceCurrency` | `USD \| TOMAN`. Optional, defaults to `USD`. Denominates **both** `price` and `fee`. `BUY`/`SELL` only — see [Toman-denominated entry](#toman-denominated-entry) |
| `occurredAt` | ISO 8601. Stored exactly as supplied; never rewritten from a live price |
| `type` | `BUY \| SELL \| TRANSFER_IN \| TRANSFER_OUT`. `DEPOSIT`/`WITHDRAWAL` exist in the enum but are **rejected** |
| `destinationType` | `EXCHANGE \| WALLET`. **Required for transfers**, dropped otherwise |
| `exchangeName` | Required when `destinationType = EXCHANGE` |
| `walletId` | Required when `destinationType = WALLET`; must belong to the caller |
| `txid` | Always optional; only meaningful for an `EXCHANGE` transfer |

Business rules, in the order the use case applies them:

1. Portfolio must exist and belong to the caller → `404 PORTFOLIO_NOT_FOUND`
2. Asset must exist → `404 ASSET_NOT_FOUND`
3. `DEPOSIT`/`WITHDRAWAL` → `TRANSACTION_TYPE_NOT_SUPPORTED`
4. `BUY`/`SELL` without `price` → `TRANSACTION_PRICE_REQUIRED`
5. `SELL`/`TRANSFER_OUT` beyond the derived quantity → `INSUFFICIENT_HOLDINGS`, with
   `meta.currentHolding` and `meta.requestedAmount`. Measured through the same
   `HoldingsService` the holdings endpoint uses, so a rejection always matches what the
   user sees, and anchored on the asset's opening balance
6. Transfers: `TRANSFER_DESTINATION_REQUIRED`, `TRANSFER_EXCHANGE_NAME_REQUIRED`,
   `TRANSFER_WALLET_NOT_FOUND`
7. `priceCurrency` on a type with no price → `TRANSACTION_PRICE_CURRENCY_NOT_APPLICABLE`
8. `priceCurrency = TOMAN` with no USDT/Toman rate available →
   `TRANSACTION_PRICE_RATE_UNAVAILABLE` (503), and nothing is written

The write and the checkpoint invalidation happen atomically under a `(portfolioId,
assetId)` advisory lock, so a concurrent P&L can never checkpoint a ledger missing the new
row. On success the backend emits the realtime event `transaction.created` to
`user:{userId}`.

### Toman-denominated entry

`price` and `fee` are **always stored in USD**, because `PORTFOLIO_VALUATION_CURRENCY` is
USD and every position is valued against a USD market price. `priceCurrency` says what the
*user* typed, not what is stored:

| `priceCurrency` | `price` / `fee` | `enteredPrice` / `enteredFee` | `usdtTomanRate` |
|---|---|---|---|
| `USD` (default) | as supplied | `null` | `null` |
| `TOMAN` | converted to USD | as supplied, in Toman | rate applied |

The rate is read server-side from the same source as
[`GET /v1/market/usdt-toman`](usdt-toman.md) — never from the request — and is **frozen on
the row**. A later move in the market cannot restate a recorded transaction: a BUY entered
at 234,000 Toman still reads 234,000 Toman when the rate reaches 250,000.

Conversion is `price ÷ usdtTomanRate`, through the exact decimal helpers at the columns'
own 8-digit scale, truncated rather than rounded. Every transaction recorded before this
field existed reads back as `USD` with all three companion columns `null`, which is exactly
what those rows already meant.

`PATCH` accepts `priceCurrency` too. Because the rate is read at update time, re-saving a
Toman transaction re-stamps it at today's rate — the stored rate records the conversion
actually applied to the values now in the row.

### GET — query

| Param | Type | Default |
|-------|------|---------|
| `cursor` | string | - |
| `limit` | number | 20 (max 100) |
| `assetId` | uuid | - |
| `type` | `PortfolioTransactionType` | - |
| `from` / `to` | ISO 8601, inclusive | - |

Response: `{ items, nextCursor, total }`. Ordered `occurredAt DESC, id DESC`. `total` counts
everything matching the filters, independent of the current page.

### Transaction response

`{ id, portfolioId, assetId, type, amount, price, fee, occurredAt, notes, asset,
destinationType, exchangeName, txid, walletId, createdAt, updatedAt }` — `asset` is the full
`AssetResponseDto`; `price`, `fee`, `notes` and all four destination fields are nullable.

`PATCH` accepts `type`, `amount`, `price`, `fee`, `occurredAt`, `notes`; `{}` →
`TRANSACTION_EMPTY_UPDATE`. Editing a `SELL`/`TRANSFER_OUT` re-validates against the
quantity computed **as if the edited transaction did not exist**, so its own amount is not
double-counted. `PATCH`/`DELETE` emit `transaction.updated` / `transaction.deleted`.

---

## Portfolio Opening Balances

The starting position of an asset in a portfolio, for ledgers that begin mid-history.

| Method | Path | CSRF | Status |
|--------|------|------|--------|
| `PUT` | `/v1/portfolios/:portfolioId/opening-balances/:assetId` | Required | 200 (upsert) |
| `GET` | `/v1/portfolios/:portfolioId/opening-balances` | - | 200 `{ items }` (no cursor) |

Request: `{ openingQuantity: "1.5", openingCost: "90000" }` — both decimal strings.
Response item: `{ id, portfolioId, assetId, openingQuantity, openingCost, asset, createdAt, updatedAt }`.

These are not cosmetic: `HoldingsService` anchors its ledger replay on `openingQuantity`, so
opening balances feed the holdings list, the valuation, the oversell check on
`SELL`/`TRANSFER_OUT`, and the P&L cost basis.

---

## Wallets

Named transfer destinations owned by the caller — one address per blockchain network.

| Method | Path | CSRF | Status |
|--------|------|------|--------|
| `POST` | `/v1/wallets` | Required | 201 |
| `GET` | `/v1/wallets` | - | 200 (**bare array**, not paginated) |
| `PATCH` | `/v1/wallets/:id` | Required | 200 |
| `DELETE` | `/v1/wallets/:id` | Required | 204 |

Response: `{ id, name, addresses: [{ id, network, address }], createdAt, updatedAt }`.

`WalletNetwork` ∈ `BITCOIN | ETHEREUM | SOLANA | BNB_CHAIN | POLYGON | ARBITRUM | OPTIMISM |
AVALANCHE | BASE | TRON | OTHER`. `OTHER` is the escape hatch and accepts any non-empty
address.

Errors: `404 WALLET_NOT_FOUND`, `WALLET_EMPTY_UPDATE`, and `WALLET_IN_USE` — returned when
a transfer transaction references the wallet, with `meta.transactionCount`.

---

## Assets

The shared, read-only CoinGecko-synchronised currency catalogue. Independent of users,
portfolios and wallets; both read routes need only a valid session.

| Method | Path | Auth | CSRF | Status |
|--------|------|------|------|--------|
| `GET` | `/v1/assets?search,cursor,limit` | Authenticated | - | 200 |
| `GET` | `/v1/assets/:id` | Authenticated | - | 200 |
| `POST` | `/v1/assets/sync` | **OWNER**, 12/hour | Required | **202 Accepted** |

`search` is a case-insensitive substring over symbol and name. `limit` defaults to 20, max
100. Response: `{ items, nextCursor }`.

`AssetResponseDto`: `{ id, coinGeckoId, symbol, name, imageUrl, currentPrice, marketCap,
marketCapRank, totalVolume, circulatingSupply, totalSupply, maxSupply, priceChange24h,
priceChangePercentage24h, lastSyncedAt, createdAt, updatedAt }`. Every monetary field is a
nullable decimal **string**; `marketCapRank` is a nullable number.

`POST /v1/assets/sync` enqueues a BullMQ job rather than syncing inline, so the request never
waits on CoinGecko; an already-pending job is deduplicated. A repeating job refreshes the
catalogue every `ASSET_SYNC_INTERVAL` seconds (default **3600**) — so `currentPrice` here,
and therefore portfolio valuation and P&L, are **hourly**, not live. For live prices use
`/v1/market/*`.

---

## Market Data

Backend-owned snapshots of external providers. All authenticated; all read-through an
in-memory, per-replica TTL cache — the browser never calls these providers directly.

| Method | Path | Upstream | Cache TTL (env) |
|--------|------|----------|-----------------|
| `GET` | `/v1/market/overview` | CoinGecko `/global` | 90 s (`MARKET_OVERVIEW_CACHE_TTL_MS`) |
| `GET` | `/v1/market/bitcoin` | CoinGecko `/simple/price` | 30 s (`COIN_TICKER_CACHE_TTL_MS`) |
| `GET` | `/v1/market/ethereum` | CoinGecko `/simple/price` | 30 s (same) |
| `GET` | `/v1/market/usdt-toman` | Nobitex `usdt-rls` **or** Wallex `USDTTMN` | 60 s (`USDT_TOMAN_CACHE_TTL_MS`) |
| `GET` | `/v1/market/fear-greed` | alternative.me `/fng` | 5 min (`FEAR_GREED_CACHE_TTL_MS`) |

Every response carries the same freshness triple:

- `updatedAt` — when the **provider** computed the value
- `fetchedAt` — when this backend last **successfully fetched** it
- `isStale` — `true` only when the live provider call failed and a previously-cached value
  was served instead

```jsonc
// /v1/market/overview
{ "totalMarketCapUsd": "2412345678901.23", "marketCapChangePercentage24h": "1.24",
  "btcDominancePercentage": "51.32", "ethDominancePercentage": "17.84",
  "updatedAt": "...", "fetchedAt": "...", "isStale": false }

// /v1/market/bitcoin and /v1/market/ethereum
{ "priceUsd": "112345.67000000", "priceChangePercentage24h": "1.24",
  "updatedAt": "...", "fetchedAt": "...", "isStale": false }

// /v1/market/usdt-toman  — Toman, not Rial
{ "priceToman": "234619", "priceChangePercentage24h": "3.3000", "provider": "nobitex",
  "updatedAt": "...", "fetchedAt": "...", "isStale": false }

// /v1/market/fear-greed
{ "value": 74, "classification": "Greed", "updatedAt": "...",
  "nextUpdateAt": "...", "fetchedAt": "...", "isStale": false }
```

`/v1/market/usdt-toman` is the only route with **two** upstreams. `USDT_TOMAN_PROVIDER`
(`nobitex` | `wallex`) picks the preferred exchange and the other is the automatic
fallback; `provider` on the response reports which one actually answered. Both are
normalised to Toman — Nobitex quotes an `usdt-rls` (Rial) market and is divided by
`RIAL_PER_TOMAN` (default 10), Wallex quotes `USDTTMN` in Toman already — so the number
means the same thing either way. See [usdt-toman.md](usdt-toman.md).

Provider failures surface as `MARKET_OVERVIEW_PROVIDER_*` / `MARKET_SENTIMENT_PROVIDER_*`
codes (`RATE_LIMITED`, `TIMEOUT`, `UNAVAILABLE`, `BAD_REQUEST`, `INVALID_RESPONSE`).
When *every* exchange behind `/v1/market/usdt-toman` fails and nothing is cached, the
route returns `MARKET_OVERVIEW_PROVIDERS_EXHAUSTED` (502) rather than one venue's error.

Caches are per-replica and in memory. At more than one instance, upstream request volume
scales with instance count and different replicas may report slightly different values.

---

## Logs

Operational log readers. Both restricted to the **OWNER** role at the class level.

| Method | Path | Requires | Description |
|--------|------|----------|-------------|
| `GET` | `/v1/logs/audit` | OWNER | Audit trail (MongoDB), cursor-paginated |
| `GET` | `/v1/logs/system` | OWNER | System/application logs (MongoDB), cursor-paginated |

`/audit` filters: `cursor`, `limit`, `userId`, `action`, `resourceType`, `resourceId`,
`actorType`, `success`, `startDate`, `endDate`, `requestId`.

`/system` filters: `cursor`, `limit`, `level`, `event`, `context`, `startDate`, `endDate`,
`requestId`, `userId`.

Both return `{ items, nextCursor }`. System logs include unhandled 5xx exceptions written by
`GlobalExceptionFilter`, with `metadata.statusCode`, `code`, `domain`, `method` and `url`.
These are cross-user records — hence the OWNER restriction.

---

## Realtime (Socket.IO)

Socket.IO attaches to the **same HTTP server and port** as REST (no separate port), with the
same CORS allowlist applied to the handshake.

**Authentication:** the handshake reads the `access_token` cookie and runs it through the
same verification and validation services as the HTTP `JwtGuard`, so a socket can never
exist under an identity REST would reject. Failure disconnects without explanation.

**Rooms are server-derived:** on success the socket joins `user:{userId}` and
`session:{sessionId}` from the *resolved* session. There are **no `@SubscribeMessage`
handlers** — a client cannot request a room, and never declares who it is.

| Event (server → client) | Payload |
|---|---|
| `transaction.created` | `{ portfolioId, transactionId }` |
| `transaction.updated` | `{ portfolioId, transactionId }` |
| `transaction.deleted` | `{ portfolioId, transactionId }` |
| `price-alert.triggered` | `{ alertId, coinId, direction, targetPrice, currentPrice }` |

Payloads carry identifiers only. Clients are expected to refetch through REST rather than
trust a pushed snapshot.

`RealtimeService` also exposes `disconnectSession`, `disconnectUser` and
`disconnectUserExcept`, so session revocation reaches live sockets.

---

## Scheduled & Background Jobs

Jobs that change what the API returns:

| Job | Schedule | Guard | Effect |
|-----|----------|-------|--------|
| Asset sync (BullMQ repeating) | every `ASSET_SYNC_INTERVAL` s (default 3600) | BullMQ dedupe | Rewrites `asset.currentPrice` → **portfolio valuation and P&L** |
| Price check (`@Cron` EVERY_MINUTE) | 1 min | Redis lock, 5 min TTL | Expires alerts, evaluates threshold crossings, queues emails, emits `price-alert.triggered` |
| Coin sync (`@Cron` daily 1 AM) | daily | Redis lock | Refreshes the `/v1/coins` catalogue |
| Pending-user cleanup (`@Cron` every 30 min) | 30 min | Redis lock | Removes unverified accounts |
| Email queue (BullMQ, on demand) | — | `dedupeKey` | Verification codes, price-alert notifications |

`EmailPublisher.publish` resolves once a message is **durably accepted for delivery**, not
once it is delivered. Delivery is asynchronous and at-least-once — a `2xx` from an endpoint
that sends mail says nothing about whether it reached an inbox.

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

`ValidationPipe` runs globally with `whitelist: true`, `forbidNonWhitelisted: true` and
`enableImplicitConversion: false`, so an unknown body field is **rejected**, not stripped,
and a string is never coerced into a declared number.

Validation errors return `422 UNPROCESSABLE ENTITY` with:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "domain": "VALIDATION",
    "message": "<first class-validator constraint message>",
    "meta": { "field": "<offending property>" },
    "path": "...",
    "timestamp": "..."
  }
}
```

The machine-readable code on the wire is **`VALIDATION_ERROR`**. Note the trap: the
enum member is named `DomainErrorCode.VALIDATION` but its *value* is
`'VALIDATION_ERROR'` (see `core/errors/domain-error-code.enum.ts`), and it is the
value that clients see. `domain` is `VALIDATION`. Branch on the code value, and
`meta.field` names the property that failed. Clients should branch on `code` and render
`meta.field`, not parse `message`.

---

## Cookies

Issued by `AuthCookieService.set` (invoked by `AuthCookieInterceptor` on login and refresh).

| Cookie | Type | HTTP-only | Secure | SameSite | Max-Age | Description |
|--------|------|-----------|--------|----------|---------|-------------|
| `access_token` | JWT (`aud: api`) | Yes | production only | `strict` in production, else `lax` | 15 min | Authenticates every REST request and the Socket.IO handshake |
| `refresh_token` | JWT (`aud: refresh`) | Yes | production only | `strict` in production, else `lax` | 7 days | Single-use; rotated on every refresh |
| `csrf_token` | `nonce.expiresAt.signature` | **No** (readable by design) | production only | `strict` in production, else `lax` | 7 days (`CSRF_TOKEN_TTL_MS`) | Double-submit token; echoed by the client as `X-CSRF-Token` |

`csrf_token` is deliberately readable so the browser client can copy it into the request
header. Its signature is `HMAC-SHA256(nonce.expiresAt.sessionId)`, so it is bound to one
session and cannot be forged or replayed across sessions.

`DELETE /v1/sessions` clears `csrf_token` only. The two HttpOnly cookies remain in the
browser until they expire, but are inert: `TokenValidationService` re-checks session
liveness on every request, so a revoked session is rejected immediately.

> **Deployment note.** `sameSite: 'strict'` in production means the browser withholds these
> cookies on cross-**site** requests. A frontend and backend on different subdomains of one
> registrable domain (`app.example.com` / `api.example.com`) are same-site and work. Genuinely
> different registrable domains do **not** — authentication will fail entirely, including the
> WebSocket handshake.
