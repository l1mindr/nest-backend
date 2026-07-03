# Redis Usage

This document describes how Redis is used in the system, the abstraction layer (`RedisService`), the locking helper (`RedisLockService`), why locks are needed, their limitations, and future caching usage.

---

## Overview

Redis is used for ephemeral, fast data and coordination: locks, short-lived caches, counters, and other low-latency primitives. Access to Redis should go through a small abstraction layer to centralize connection management, error handling, and metrics.

---

## RedisService (abstraction)

Purpose:
- Encapsulate the Redis client (ioredis) and provide typed helper methods for common operations used across the codebase.

Recommended API surface (conceptual):
- `get(key: string): Promise<string | null>`
- `set(key: string, value: string, opts?: { ttl?: number, nx?: boolean }): Promise<void>`
- `del(key: string): Promise<number>`
- `eval(script: string, keys: string[], args: string[]): Promise<any>`
- `multi() / exec()` for transactional pipelines
- `incr`, `decr`, `expire`, `ttl`

Why abstraction:
- Centralized retry/backoff policies and connection pooling.
- Standardized serialization/namespace conventions (prefixes, JSON encoding).
- Centralized instrumentation (latency, errors) and unified error translation.
- Safer client replacement (e.g., switch library or cluster config) without touching business code.

Implementation notes:
- Use `ioredis` with cluster support if deploying clustered Redis.
- Add an application-level prefix for keys (configurable by environment).
- Wrap operations to handle `MOVED`/`ASK` responses and transient network errors with retry policies.

---

## RedisLockService (design)

Purpose:
- Provide a convenient and safe API to acquire distributed locks for critical sections (e.g., token rotation, single-winner jobs).

Recommended API:
- `acquireLock(key: string, ttlMs: number): Promise<LockHandle | null>` — returns a handle if lock acquired.
- `releaseLock(handle: LockHandle): Promise<boolean>`
- `extendLock(handle: LockHandle, ttlMs: number): Promise<boolean>`

Lock internals:
- Use `SET key value NX PX ttl` to acquire a lock with a unique value (UUID) and TTL.
- Store the unique value in the handle and require it during `release` (use Lua script to `GET`+`DEL` atomically if value matches).
- Use `eval` to run a small Lua script for conditional delete and safe extension.

Example release script (atomic):

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
```

Why use locks:
- Prevent concurrent processes from performing conflicting operations (e.g., two services rotating the same refresh token simultaneously when optimistic concurrency is not available).
- Coordinate single-run jobs (cron-style work) across multiple instances.

---

## Why locks exist (when used)

- Ensure mutually exclusive access to resources with side effects (file writes, third-party API calls, single-writer DB migrations, leader election, or complex multi-step flows where optimistic concurrency is not practical).
- Provide a lightweight coordination primitive that is faster than a DB transaction for certain patterns.

Note: for refresh token rotation the recommended approach is optimistic DB conditional update (see `docs/sessions.md`). Use locks only when DB atomic operations are unavailable or when coordinating cross-datastore actions.

---

## Limitations and pitfalls of Redis locks

1. TTL vs process pause/crash:
   - Locks rely on TTLs. If a process crashes after acquiring a lock but before completing work, the lock will eventually expire and another process may acquire it; this can cause double-processing if the original process resumes and completes later.
2. Clock drift and network partitions:
   - Distributed lock safety depends on reasonably well-synchronized clocks and reliable network. In partitioned networks, two nodes may think they hold the lock.
3. Single Redis instance risk:
   - If Redis is a single node and it fails, locks may be lost; consider Redis Cluster or Redlock patterns for stronger guarantees (with caveats below).
4. Redlock controversy:
   - The recommended Redlock algorithm (multiple Redis masters) provides stronger safety only when implemented correctly and the deployment meets its assumptions. Understand trade-offs before attempting Redlock in production.
5. Complexity and operational cost:
   - Locks add complexity (renewal, extension, monitoring) and can become a source of outages if misused.

Best practices to mitigate limitations:
- Use short TTLs and design idempotent protected operations.
- Implement lock renewal (`extendLock`) carefully; prefer domain-level idempotency if possible.
- Monitor lock acquisition/release rates and failures.
- Prefer atomic DB updates (optimistic concurrency) for single-winner state transitions where possible.

---

## Future caching usage

Planned or potential uses for Redis caching:
- Short-lived lookup caches (e.g., feature flags, small lookup tables) with TTLs and cache warming.
- Rate limiting counters (per-IP or per-user) using `INCR` and TTL.
- Session or token blacklists with short TTL aligned with access token expiry for revocation.
- Computed views or aggregation caches for dashboards, invalidated on upstream changes.

Caching patterns:
- Use cache-aside pattern for most cases: check cache -> on miss, read DB -> populate cache.
- Avoid using Redis as the source of truth for critical data unless explicit replication/consistency strategies are designed.
- Use appropriate TTLs and versioned keys to support invalidation.

---

## Observability & Operations

- Instrument every Redis call for latency and error rates.
- Track lock failure and renewal counts.
- Alert on high error rates or large numbers of expired locks.
- Use connection pooling and size pools according to traffic patterns.
- Backup Redis config and use ACLs for restricted credentials.

---

## Summary

- `RedisService` centralizes Redis access and error/serialization policies.
- `RedisLockService` provides a safe lock acquire/release/extend API using `SET NX PX` and atomic Lua scripts.
- Prefer optimistic DB updates for single-winner critical flows (sessions rotation); use locks for cross-datastore coordination or when DB atomicity isn't sufficient.
- Be aware of TTL, clock drift, partition, and single-node failure modes; design for idempotency and monitoring.
- Redis will also serve future caching and rate-limiting needs; use cache-aside and versioned keys.
