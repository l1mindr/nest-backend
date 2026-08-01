# Sessions

## Overview

Server-side session management with refresh token hashing, optimistic concurrency for rotation, and cursor-based pagination for listing.

Session entity stores the refresh token hash (not the raw token), device metadata, and version field for optimistic locking.

---

## Session Entity

```typescript
class Session {
  id: string;              // UUID primary key
  refreshTokenHash: string; // SHA-256 hash of refresh token
  device: ISessionDevice;   // JSONB — browser, OS, device type
  ipAddress: string;        // Client IP at creation
  isRevoked: boolean;       // Soft revocation flag
  expiresAt: Date;          // 7 days from creation
  lastUsedAt: Date;         // Updated on refresh
  version: number;          // Optimistic concurrency counter
  rotatedAt: Date;          // Last rotation timestamp
  createdAt: Date;
  updatedAt: Date;
  owner: User;              // ManyToOne relation
}
```

Indexed on `(owner, isRevoked, expiresAt)`, `(owner, isRevoked, expiresAt, createdAt)`, and `expiresAt` for query performance.

---

## Session Lifecycle

### Issue

**Use case**: `SessionIssueUseCase` (symbol: `SESSION_ISSUE_USE_CASE`)

Called during login:

1. Opens a transaction and acquires a `pessimistic_write` lock on the user row to prevent concurrent session creation races
2. Creates the new session (placeholder refresh token hash)
3. Counts current active sessions
4. If the count exceeds `MAX_ACTIVE_SESSIONS`, revokes the oldest excess sessions (LRU by `lastUsedAt`)
5. Returns the session for token issuance

### Rotation

**Use case**: `SessionRotationUseCase` (symbol: `SESSION_ROTATION_USE_CASE`)

Called during refresh:

1. Issues new access + refresh token pair
2. Calls `rotateRefreshToken(sessionId, version, oldHash, newHash, meta)`:
   ```sql
   UPDATE "session"
   SET "refresh_token_hash" = :newHash,
       "version"            = "version" + 1,
       "rotated_at"         = :now,
       "last_used_at"       = :now,
       "expires_at"         = :newExpiresAt
   WHERE "id" = :sessionId
     AND "refresh_token_hash" = :oldHash
     AND "version" = :version
   ```
3. If 0 rows affected → hash mismatch → reuse detected → revoke session

### Revocation

**Use case**: `SessionRevocationUseCase` (symbol: `SESSION_REVOCATION_USE_CASE`)

Supports:

| Method | Description |
|--------|-------------|
| `revoke(userId, sessionId)` | Revokes a single session (logout via `DELETE /v1/sessions`) |
| `revokeAll(userId, manager?)` | Revokes all sessions for a user (used in suspend, delete account). Accepts optional `EntityManager` for transaction participation. |
| `terminateOthers(userId, sessionId, manager?)` | Revokes all sessions except the current one (used in change-password, `DELETE /v1/sessions/others`) |

Revocation sets `isRevoked = true`. Expired sessions are also treated as revoked by the query layer.

### Listing

**Endpoints**:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/sessions` | List active sessions (cursor-paginated) |
| `DELETE` | `/v1/sessions` | Revoke current session (logout) |
| `DELETE` | `/v1/sessions/others` | Revoke all other sessions |

**Cursor pagination**: Sessions are ordered by `lastUsedAt ASC, id ASC`. Uses `SessionCursorService` for cursor encoding and `SessionListService` for paginated queries.

**Response**:
```typescript
{
  items: SessionResponseDto[];
  currentSession: { id: string }; // Current session ID for highlighting
  nextCursor: string | null;
}
```

---

## Max Active Sessions

Controlled by the required `MAX_ACTIVE_SESSIONS` environment variable (integer, min 5).

Behavior:
- When a new session would exceed the limit, the least recently used (LRU) sessions are revoked
- The new session is created first, then the active count is checked; if it exceeds `MAX_ACTIVE_SESSIONS`, the `excess = activeCount - MAX_ACTIVE_SESSIONS` oldest sessions (by `lastUsedAt`) are revoked
- All happens within the same transaction under a pessimistic write lock on the user row

---

## Atomic Rotation

Refresh token rotation uses a conditional UPDATE pattern:

```typescript
async execute(
  sessionId: string,
  version: number,
  oldHash: string,
  newHash: string,
  meta: { now: number; expiresAt: Date }
): Promise<boolean> {
  return this.sessionRepository.rotateRefreshToken(
    sessionId, version, oldHash, newHash, meta
  );
}
```

`rotateRefreshToken` performs the conditional UPDATE and returns `result.affected === 1`.

If the update affects 0 rows, it means:
- The `refreshTokenHash` doesn't match (old token already rotated) → reuse detected, OR
- The `version` doesn't match (concurrent rotation won) → reuse detected

In both cases the session is revoked to prevent token theft.

---

## Data Flow

```
Login:
  LoginUseCase
    → SessionIssueUseCase.execute(userId, ipAddress, device, expiresAt)
      → Lock user row (pessimistic_write) in transaction
      → INSERT session (placeholder hash)
      → Count active sessions
      → Revoke excess if over MAX_ACTIVE_SESSIONS
      → Return session
    → TokenIssueService.issuePair(userId, sessionId)
      → Sign access_token (15min, secret A)
      → Sign refresh_token (7d, secret B)
    → RefreshTokenHasher.hash(refreshToken) → SessionRotationUseCase.saveHash(session)
    → AuthCookieInterceptor sets cookies

Refresh:
  RefreshUseCase
    → Acquire Redis lock for session
    → Verify refresh JWT (secret B)
    → Load active session by ID
    → Compare refresh token hash (SHA-256)
    → Check version + hash guard (reuse detection)
    → TokenIssueService.issuePair(userId, sessionId)
    → SessionRotationUseCase.execute(...)
      → Conditional UPDATE (hash + version check)
      → If 0 affected → revoke session (reuse detected)
    → Release Redis lock
    → AuthCookieInterceptor sets cookies
```

---

## Error Codes

| Code | Scenario | HTTP |
|------|----------|------|
| `SESSION_NOT_FOUND` | Session ID not found | 404 |
| `SESSION_EXPIRED` | Session has expired | 401 |
| `SESSION_REVOKED` | Session was revoked | 401 |
| `SESSION_REUSE_DETECTED` | Old refresh token used after rotation | 401 |
| `REFRESH_RATE_LIMITED` | Refresh attempted within the rate-limit window | 429 |
| `INVALID_CURSOR` | Malformed pagination cursor | 400 |
