# Redis, Caching, and Ephemeral State

The current project uses Redis for counters and a refresh-flow key helper. No general-purpose caching layer is implemented.

## Relevant Files

- [src/infrastructure/config/databases/redis.config.ts](../src/infrastructure/config/databases/redis.config.ts)
- [src/infrastructure/databases/redis/redis.module.ts](../src/infrastructure/databases/redis/redis.module.ts)
- [src/infrastructure/databases/redis/redis.provider.ts](../src/infrastructure/databases/redis/redis.provider.ts)
- [src/infrastructure/databases/redis/redis.service.ts](../src/infrastructure/databases/redis/redis.service.ts)
- [src/infrastructure/databases/redis/redis-counter.service.ts](../src/infrastructure/databases/redis/redis-counter.service.ts)
- [src/infrastructure/databases/redis/redis-lock.service.ts](../src/infrastructure/databases/redis/redis-lock.service.ts)
- [src/infrastructure/databases/redis/keys/redis-key.enum.ts](../src/infrastructure/databases/redis/keys/redis-key.enum.ts)

## Redis Configuration

The Redis config factory reads:

- `REDIS_HOST`, default `localhost`.
- `REDIS_PORT`, default `6379`.
- `REDIS_PASSWORD`, optional.
- `REDIS_DB`, default `0`.

`redisProvider` creates an `ioredis` client with those values.

## RedisModule

`RedisModule` is global and provides:

- `RedisService`
- `RedisLockService`
- `RedisCounterService`

It exports:

- `RedisLockService`
- `RedisCounterService`

## RedisService

`RedisService` wraps the Redis client and exposes:

- `client`: raw `ioredis` instance.
- `set(key, value)`.
- `setWithExpiry(key, value, ttlSeconds)`.
- `del(key)`.
- `get(key)`.
- `onModuleDestroy()`: calls `redis.quit()`.

## RedisCounterService

Used by rate limiting.

Methods:

- `get(key)`.
- `increment(key, ttl?)`.

`increment()` calls Redis `INCR`. If the value becomes `1` and a TTL was provided, it sets the expiry.

## Rate Limiting

`RateLimitService` builds keys as:

```text
rate:limit:{route}:{ip}
```

It increments the key and checks whether the count is within the configured route limit.

`RedisKey.RATE_LIMIT` is `rate:limit`.

## RedisLockService

Used by `AuthService.refresh()`.

Keys are built as:

```text
refresh:lock:{sessionId}
```

`RedisKey.REFRESH_LOCK` is `refresh:lock`.

Current behavior:

- `acquire()` calls `setWithExpiry()`, which uses Redis `SET key value EX ttl`.
- It returns true when Redis returns `OK`.
- `release()` deletes the key.

Important limitation: `acquire()` does not use `NX` and does not store a unique lock value, so it does not guarantee mutual exclusion. If strict locking is needed, the implementation should use `SET key value NX EX ttl` and release only when the stored value matches the caller's token.

## What Is Not Implemented

- No cache-aside wrapper exists.
- No serialization/deserialization cache helper exists.
- No Redis namespace/prefix beyond the enum key strings exists.
- No Redis cluster/sentinel configuration exists.
- No Redis retry/backoff customization was found.
- No metrics or tracing around Redis operations was found.
