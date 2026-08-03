export enum RedisKey {
  COIN_SYNC_LOCK = 'coin-tracker:sync:lock',
  PRICE_CHECK_LOCK = 'coin-tracker:price-check:lock',
  REFRESH_LOCK = 'refresh:lock',
  // Root of every rate-limit key: `rl:{prefix}:{identifier}:{hash}`. The keys
  // themselves are built by RateLimitKeyBuilder, which owns the hashing.
  RATE_LIMIT = 'rl'
}
