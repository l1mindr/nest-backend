# Caching

## Redis Infrastructure

Redis is used for rate limiting, distributed locking, and atomic counters. Not used for general-purpose caching (no cache-aside pattern).

## Services

| Service | Purpose | Key Pattern |
|---------|---------|-------------|
| `RedisService` | Core Redis client wrapper. `get`, `set`, `setIfNotExists` (`NX`), `setWithExpiry` (`EX`), `setIfNotExistsWithExpiry` (`EX` + `NX`), `del`, `compareAndDelete` (Lua), `eval` | Generic |
| `RedisCounterService` | Atomic increment with TTL via Lua script. Used for rate limiting. | `rate:limit:{route}:{ip}` |
| `RedisLockService` | Distributed lock with acquire/release. Used for refresh flow synchronization. | `refresh:lock:{sessionId}` |

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
  RATE_LIMIT = 'rate:limit'
}
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | localhost | Redis server host |
| `REDIS_PORT` | 6379 | Redis server port |
| `REDIS_PASSWORD` | - | Redis password |
| `REDIS_DB` | 0 | Redis database index |
