# Caching

## Redis Infrastructure

Redis is used for rate limiting, distributed locking, and atomic counters. Not used for general-purpose caching (no cache-aside pattern).

## Services

| Service | Purpose | Key Pattern |
|---------|---------|-------------|
| `RedisService` | Core Redis client wrapper. `get`, `set`, `setIfNotExists` (`NX`), `setWithExpiry` (`EX`), `setIfNotExistsWithExpiry` (`EX` + `NX`), `del`, `compareAndDelete` (Lua), `eval` | Generic |
| `RateLimitStoreService` | Fixed window plus temporary block, one Lua script per decision. Backs every rate limit. | `rl:{prefix}:{identifier}:{hash}` |
| `RedisCounterService` | Generic atomic increment with TTL via Lua script. | — |
| `RedisLockService` | Distributed lock with acquire/release. Used for refresh flow synchronization. | `refresh:lock:{sessionId}` |

## Rate Limiting

Every counter is written by `RateLimitStoreService` through a single Lua script
per decision, so the block check, the increment, and the expiry cannot
interleave with another client. See
[security.md](security.md#rate-limiting) for the policy catalogue.

Keys are `rl:{prefix}:{identifier}:{hash}` plus a `:blocked` companion holding
the temporary block. The identifier is HMAC-SHA256'd with
`SECURITY_HASH_SECRET`, so a Redis dump discloses no addresses or verification
codes.

| Key | Purpose |
|-----|---------|
| `rl:login:ip:{hash}` | Per-address login budget |
| `rl:login:email:{hash}` | Per-account login budget (+ `:blocked`) |
| `rl:login:device:{hash}` | Per-device login budget (+ `:blocked`) |
| `rl:register:{ip,device}:{hash}` | Registration budgets |
| `rl:verify:{ip,device,email,code}:{hash}` | Verification budgets |
| `rl:resend:{ip,device,email}:{hash}` | Resend budgets |
| `rl:refresh:{ip,device}:{hash}` | Token refresh budgets |
| `rl:password:{ip,user}:{hash}` | Password change budgets |
| `rl:alert:{ip,user}:{hash}` | Price alert budgets |
| `rl:verify:attempts:user:{hash}` | Failed verification attempts; invalidates the code at 5 |
| `rl:resend:cooldown:user:{hash}` | 60s resend cooldown (`limit: 1`) |
| `rl:resend:hourly:user:{hash}` | Hourly resend allowance |

All keys carry a TTL and expire on their own; nothing needs sweeping.

## Refresh Lock

`RedisLockService`:
- `acquire(lockKey, lockIdentifier, ttlSeconds = 5)` — `SET key randomUUID() EX ttl NX`; returns the token on success, `null` if already held
- `release(lockKey, lockIdentifier, token)` — Lua compare-and-delete; only deletes if the stored value matches the token (prevents releasing someone else's lock)

The database conditional update on session rotation remains the authoritative mechanism; the Redis lock reduces contention on concurrent refreshes.

## Key Management

Keys are defined in `RedisKey` enum:

```typescript
export enum RedisKey {
  COIN_SYNC_LOCK = 'coin-tracker:sync:lock',
  PRICE_CHECK_LOCK = 'coin-tracker:price-check:lock',
  REFRESH_LOCK = 'refresh:lock',
  RATE_LIMIT = 'rl'
}
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | localhost | Redis server host |
| `REDIS_PORT` | 6379 | Redis server port |
| `REDIS_PASSWORD` | - | Redis password |
| `REDIS_DB` | 0 | Redis database index |
