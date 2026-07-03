# Sessions Architecture — Safe Refresh Design

This document is the authoritative reference for session and refresh-token handling in this project. It explains the evolution of the refresh design, the concurrency (race) problems encountered, why naive locking is insufficient, and the final safe architecture based on versioning and atomic updates. It includes lifecycle explanations, step-by-step flows, reuse detection logic, and an illustrative sequence diagram.

---

## Goals

- Allow long-lived user sessions with the ability to silently obtain short-lived access tokens.
- Prevent refresh-token replay/reuse attacks and race conditions that can create multiple valid refresh tokens.
- Provide clear revocation semantics so users can revoke single-device sessions.
- Keep the design auditable, testable, and operationally simple.

---

## Glossary

- Refresh token: a long-lived, opaque credential used to obtain new access tokens.
- Session: server-side record representing a device or login session, storing metadata and refresh-related state.
- Rotation counter / Version: a numeric version associated with the session that increments on each refresh rotation.
- Rotation (or token rotation): replacing an issued refresh token with a new one during a refresh operation.

---

## 1) Old Refresh Approach (stateless / simple server-backed)

Typical initial design used one of two patterns:

A. Stateless signed refresh JWTs: issue long-lived signed tokens and validate signature & exp without server-side storage.

B. Server-backed single refresh token: store a single refresh token per session (token value or its hash), accept it at `/auth/refresh`, then replace with a new refresh token on each use.

Both approaches can work functionally, but B (server-backed) was preferred since it allowed immediate revocation.

---

## 2) The Problem: Race Conditions

Scenario:

- Client makes two concurrent refresh requests (e.g., due to network retry, multiple tabs, or race between background refresh and manual action).
- Both requests present the same current refresh token (R0) to the server.
- Naive server logic: validate R0, generate new tokens R1 and R2, persist the latest token state, return tokens to both requests.

Result:

- Both R1 and R2 become valid concurrently (or one overwrites the other unpredictably), allowing token reuse or inconsistent session state.
- Attacker who obtains one of the rotated tokens can still use another issued token. Reuse detection and revocation are complicated.

This is the classic refresh race: two legitimate refreshes cause duplicate valid tokens.

---

## 3) Why Redis Lock Alone Is NOT Enough

A common mitigation is to use a distributed lock (Redis) keyed by `sessionId` during refresh processing. However, locks alone have drawbacks:

- Lock expiration: if the server handling the refresh is slow or crashes, the lock may expire and a concurrent request can start processing, recreating the race window.
- Deadlocks and availability: misuse of locks can reduce availability and increase operational complexity.
- Lock granularity and latency: extra round-trips and contention on hot sessions (popular accounts) cause performance issues.
- Complexity of recovery: ensuring strict ordering and handling lock failures adds code paths to test.

In short: locks can reduce but not eliminate edge cases, and they add complexity.

---

## 4) Versioning Introduction (Rotation Counter)

Solution principle:

- Associate a `version` (rotation counter) with each session in the database.
- Embed the version in the refresh token (or include a reference that implies a version in the server-side entry).
- On refresh, require that the persisted session `version` matches the token `version` presented by the client.

This enables optimistic concurrency: only one refresh operation that sees the correct expected version should be able to succeed in swapping in the next version.

---

## 5) Atomic Update Strategy (Optimistic Concurrency)

Use an atomic, conditional update in the data store to replace refresh-related state only if the stored version equals the presented version.

Example SQL (pseudocode):

```sql
-- parameters: :session_id, :expected_version, :new_refresh_hash, :new_version
UPDATE sessions
SET refresh_hash = :new_refresh_hash,
    version = :new_version,
    last_activity_at = now()
WHERE id = :session_id AND version = :expected_version;
```

After this update, check affected rows: if `rows_affected == 1`, the rotation succeeded; if `rows_affected == 0`, another process rotated first (concurrent refresh) — treat this as a reuse/race.

Why atomic DB update:

- The DB enforces the single-winner property: only one concurrent request can transition the session from version N to version N+1.
- Avoids separate check-then-write windows where two processes both pass validation.
- Simpler and more reliable than external locking mechanisms — leverages proven DB isolation primitives.

Notes:

- Use a single statement update if possible. If multiple tables must change, perform changes in a transaction with the same optimistic concurrency check.
- Row-level locks (SELECT ... FOR UPDATE) can also be used but optimistic updates are simpler and scale better for this use-case.

---

## 6) Refresh Token Format & Storage (recommended)

- Issue opaque refresh tokens (random, unguessable) and store only a hashed value in the DB (bcrypt/sha256 with salt for storage protection).
- The token payload sent to the client can include `sessionId` and `version` or the token can be purely random and mapped to the session in the DB.

A recommended design:

- Refresh token: `base64(random_bytes || sessionId || version || HMAC)` OR: simply a high-entropy random string with DB mapping to `sessionId` and `version`.
- Store: `sessions.refresh_hash` (hash of latest refresh token), `sessions.version`.

When rotating, compute `new_refresh_hash` for the new token, and perform the atomic update using the expected `version` (or expected `refresh_hash`), then return the new refresh token to the client.

---

## 7) Reuse Detection Logic

If a refresh request fails the atomic update check (0 rows affected), there are two main causes:

A. A concurrent legitimate refresh already succeeded (race); the current request now holds a stale token.
B. A malicious replay: the refresh token was stolen and used elsewhere earlier, and now this (stale) request is using the same token.

To distinguish, implement these checks:

1. If the presented refresh token's hash matches the session's *previous* value (if you store the last N used hashes), then this is token reuse — revoke session and alert.
2. If the presented refresh token does not match current or recent stored hashes, treat as invalid token.

Actions on reuse detection:

- Immediately revoke the session: set `revoked_at`, delete refresh_hash, notify the user, log the event, and optionally revoke other sessions.
- Invalidate any issued access tokens for that session (depending on revocation strategy — e.g., mark session revoked and ensure access checks include session validity).

Store a small denylist or reuse-detection table when implementing rotation detection: store the previous token hash for one rotation window to detect replay.

---

## 8) Final Safe Refresh Architecture (step-by-step)

High-level summary:

- Use server-backed opaque refresh tokens.
- Bind each refresh token to a `session` with a numeric `version`.
- On refresh, perform a single atomic update conditional on `version` (optimistic concurrency).
- On success: return new access token and rotated refresh token (with new version).
- On atomic-update failure: treat as reuse/race; detect reuse using stored previous-hash; revoke session on confirmed reuse.

Step-by-step flow (detailed):

1. Login: create `session` record: `id`, `userId`, `refresh_hash` (hash of R0), `version = 0`, `deviceInfo`, `createdAt`.
2. Server returns `access_token (short-lived)` and `refresh_token R0` (opaque, contains or maps to `sessionId` and version 0).
3. Client stores `refresh_token` securely (HttpOnly cookie or secure storage).
4. When access token expires, client sends `POST /auth/refresh` with `refresh_token`.
5. Server receives token, extracts `sessionId` and `presented_version` (or looks up session by token), and validates token integrity.
6. Server computes `new_refresh_token` and `new_refresh_hash`, sets `new_version = presented_version + 1`.
7. Perform atomic update:
   - `UPDATE sessions SET refresh_hash = :new_refresh_hash, version = :new_version WHERE id = :sessionId AND version = :presented_version`.
8. If update affected 1 row → SUCCESS:
   - Issue new access token and return `new_refresh_token` to client.
   - Optionally store `previous_refresh_hash` for one rotation window to detect reuse.
9. If update affected 0 rows → FAILURE:
   - Fetch current session record to compare hashes.
   - If presented token matches `previous_refresh_hash` → token reuse detected: revoke session and alert.
   - Otherwise, treat as invalid/stale token -> respond with 401 and optionally revoke.

---

## 9) Sequence Diagram (final safe refresh)

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth API
    participant DB as Database

    Note over C,A: Access token expired; client has `refresh_token:R0` (version N)
    C->>A: POST /auth/refresh (send R0)
    A->>DB: SELECT session WHERE id = sessionId
    DB-->>A: session(version=N, refresh_hash=H0)
    A->>A: validate R0 matches H0
    A->>DB: UPDATE sessions SET refresh_hash=H1, version=N+1 WHERE id=sessionId AND version=N
    alt rows_affected == 1
        DB-->>A: success
        A->>C: 200 { access_token, refresh_token:R1 (version N+1) }
    else rows_affected == 0
        DB-->>A: 0 rows (concurrent rotation)
        A->>DB: SELECT session WHERE id=sessionId
        DB-->>A: session(version=M, refresh_hash=HM, previous_hash=Hprev)
        alt presented matches previous_hash
            A->>DB: mark session revoked
            A->>C: 401 (token reuse detected, session revoked)
        else
            A->>C: 401 (stale or invalid refresh token)
        end
    end
```

---

## 10) Why Versioning Solves Concurrency

- Versioning gives each refresh attempt a unique expected state; the DB guarantees that only one update from version N → N+1 can succeed.
- It transforms the race from "who writes last" into an atomic winner-loser decision enforced by the data store.
- Combined with storing `previous_hash`, it also allows detection of token replay after rotation (an attacker using an already-rotated token).

---

## 11) Why Atomic DB Update is Required

- Without atomic update, two-step check-then-write opens a race window: both requests can validate the same token before either persists the rotation.
- Atomic update (conditional WHERE version = expected) ensures a single-writer semantics without global locks and fits well with standard DB capabilities.

---

## 12) Operational Notes & Hardening

- Keep access tokens short-lived (e.g., 5–15 minutes) to reduce reliance on refresh operations.
- Rotate signing keys, and make refresh token rotation a high-priority security incident response.
- Monitor refresh endpoint metrics: spike in failures or reuse detections indicate compromise.
- For extremely high-security flows, consider multi-factor re-authentication on certain refresh conditions (e.g., new IP or device change).
- Store only hashed refresh token values in DB; never store plaintext tokens.

---

## 13) Tests to Implement

- Concurrent refresh test: simulate two simultaneous refresh requests and assert only one succeeds and the other receives 401 or reuse handling.
- Reuse detection test: simulate a stolen token replay after rotation.
- Revocation test: ensure revoked sessions reject refresh and access.
- Recovery tests: DB failover, partial transaction failures, and detection of stale previous hash.

---

## Summary

The recommended, production-safe approach uses server-backed opaque refresh tokens combined with a session `version` counter and an atomic conditional update in the database to rotate tokens. This eliminates refresh races, enables deterministic reuse detection, and provides clean revocation semantics without brittle distributed locks.
