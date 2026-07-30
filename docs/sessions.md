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

Indexed on `(owner, isRevoked, expiresAt)` and `expiresAt` for query performance.

---

## Session Lifecycle

### Issue

**Use case**: `SessionIssueUseCase` (symbol: `SESSION_ISSUE_USE_CASE`)

Called during login:

1. Acquires pessimistic user lock (via `pg_try_advisory_xact_lock`) to prevent concurrent session creation races
2. Counts current active sessions
3. If at `MAX_ACTIVE_SESSIONS` limit, revokes oldest excess sessions (LRU by `lastUsedAt`)
4. Creates new session with placeholder refresh token hash
5. Returns session ID for token issuance

### Rotation

**Use case**: `SessionRotationUseCase` (symbol: `SESSION_ROTATION_USE_CASE`)

Called during refresh:

1. Issues new access + refresh token pair
2. Calls `rotateAtomic(sessionId, oldHash, newHash, version, now)`:
   ```sql
   UPDATE "session"
   SET "refresh_token_hash" = :newHash,
       "version"            = "version" + 1,
       "rotated_at"         = :now,
       "last_used_at"       = :now
   WHERE "id" = :sessionId
     AND "refresh_token_hash" = :oldHash
     AND "version" = :oldVersion
   ```
3. Uses **Lua script** on Redis for atomicity (though operation is pure SQL)
4. If 0 rows affected → hash mismatch → reuse detected → revoke session

### Revocation

**Use case**: `SessionRevocationUseCase` (symbol: `SESSION_REVOCATION_USE_CASE`)

Supports:

| Method | Description |
|--------|-------------|
| `revokeAll(userId, manager?)` | Revokes all sessions for a user (used in suspend, password change). Accepts optional `EntityManager` for transaction participation. |
| `revokeCurrent(sessionId)` | Revokes current session (logout) |
| `revokeOthers(sessionId, userId)` | Revokes all sessions except specified one |

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

Controlled by `MAX_ACTIVE_SESSIONS` environment variable (default: 5).

Behavior:
- When a new session would exceed the limit, the least recently used (LRU) sessions are revoked
- Excess sessions are calculated as: `activeCount - MAX_ACTIVE_SESSIONS + 1` (for the new one)
- Oldest sessions by `lastUsedAt` are selected for revocation
- All happens within the same transaction under a user-level advisory lock

---

## Atomic Rotation

Refresh token rotation uses a conditional UPDATE pattern:

```typescript
async rotateAtomic(
  sessionId: string,
  oldHash: string,
  newHash: string,
  expectedVersion: number,
  now: Date
): Promise<boolean> {
  const result = await this.sessionRepository.rotateAtomic(
    sessionId, oldHash, newHash, expectedVersion, now
  );
  return result.affected === 1;
}
```

If the update affects 0 rows, it means:
- The `refreshTokenHash` doesn't match (old token already rotated) → reuse detected, OR
- The `version` doesn't match (concurrent rotation won) → reuse detected

In both cases the session is revoked to prevent token theft.

---

## Data Flow

```
Login:
  LoginUseCase
    → SessionIssueUseCase.issue(userId, device, ip)
      → Acquire advisory lock for user
      → Count active sessions
      → Revoke excess if needed
      → INSERT session (placeholder hash)
      → Return sessionId
    → TokenIssueService.issuePair(userId, sessionId)
      → Sign access_token (15min, secret A)
      → Sign refresh_token (7d, secret B)
    → Store refresh token hash on session
    → AuthCookieInterceptor sets cookies

Refresh:
  RefreshUseCase
    → Acquire Redis lock for session
    → Verify refresh JWT (secret B)
    → Load active session by ID
    → Compare refresh token hash (SHA-256)
    → Check rotatedAt vs iat
    → TokenIssueService.issuePair(userId, sessionId)
    → SessionRotationUseCase.rotateAtomic(...)
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
| `SESSION_LIMIT_REACHED` | Max active sessions (informational, auto-handled) | - |
