# Caching

## Redis Infrastructure

Redis is used for rate limiting, distributed locking, and atomic counters. Not used for general-purpose caching (no cache-aside pattern).

## Services

| Service | Purpose | Key Pattern |
|---------|---------|-------------|
| `RedisService` | Core Redis client wrapper. `get`, `set`, `setIfNotExists` (`NX`), `setWithExpiry` (`EX`), `setIfNotExistsWithExpiry` (`EX` + `NX`), `del`, `compareAndDelete` (Lua), `eval` | Generic |
| `RedisCounterService` | Atomic increment with TTL via Lua script. Used for rate limiting and verification attempt counting. | `rate:limit:{route}:{ip}`, `verify:attempts:{userId}` |
| `RedisLockService` | Distributed lock with acquire/release. Used for refresh flow synchronization. | `refresh:lock:{sessionId}` |

## Verification Attempts, Rate Limit & Cooldown

`VerificationAttemptService` uses Redis to harden the email-verification flow:

- `verify:attempts:{userId}` — incremented on each wrong code via `RedisCounterService`, TTL matches the code lifetime (3 minutes); after 5 failed attempts the current code is invalidated and the counter resets
- `verify:email:{email}` — rate limit per normalized email (5 per 10 minutes); the limit is checked before any other verification logic
- `verify:resend:cooldown:{userId}` — set with `setIfNotExistsWithExpiry` (`NX` + `EX`, 60s) to enforce the resend cooldown
- `verify:resend:hourly:{userId}` — resends per hour (5 per hour); checked before the cooldown

## Rate Limiting

`RateLimitCounterService.increment(key)`:
1. `INCR` the Redis key
2. Set TTL on first increment (if previous TTL was -1)
3. Return current count

Keys auto-expire after the rate limit window.

## Refresh Lock

`RedisLockService`:
- `acquire(lockKey, lockIdentifier, ttlSeconds = 5)` — `SET key randomUUID() EX ttl NX`; returns the token on success, `null` if already held
- `release(lockKey, lockIdentifier, token)` — Lua compare-and-delete; only deletes if the stored value matches the token (prevents releasing someone else's lock)

The database conditional update on session rotation remains the authoritative mechanism; the Redis lock reduces contention on concurrent refreshes.

## Key Management

Keys are defined in `RedisKey` enum:

```typescript
enum RedisKey {
  COIN_SYNC_LOCK = 'coin-tracker:sync:lock',
  PRICE_CHECK_LOCK = 'coin-tracker:price-check:lock',
  REFRESH_LOCK = 'refresh:lock',
  RATE_LIMIT = 'rate:limit',
  VERIFY_ATTEMPTS = 'verify:attempts',
  VERIFY_RESEND_COOLDOWN = 'verify:resend:cooldown',
  VERIFY_EMAIL_RATE_LIMIT = 'verify:email',
  VERIFY_RESEND_HOURLY = 'verify:resend:hourly'
}
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | localhost | Redis server host |
| `REDIS_PORT` | 6379 | Redis server port |
| `REDIS_PASSWORD` | - | Redis password |
| `REDIS_DB` | 0 | Redis database index |
