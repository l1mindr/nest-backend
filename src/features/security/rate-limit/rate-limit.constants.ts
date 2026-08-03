/** Reflect metadata key holding the `RateLimitMetadata` a route declares. */
export const RATE_LIMIT_KEY = 'rate_limit';

/** Root segment of every rate-limit Redis key: `rl:{prefix}:{identifier}:{hash}`. */
export const RATE_LIMIT_KEY_ROOT = 'rl';

/** Suffix marking the temporary-block flag that accompanies a counter. */
export const RATE_LIMIT_BLOCK_SUFFIX = 'blocked';

/** Hex characters of the HMAC kept in a Redis key. */
export const RATE_LIMIT_HASH_LENGTH = 32;

/** Hex characters of the same HMAC kept in a log line. */
export const RATE_LIMIT_FINGERPRINT_LENGTH = 12;

export const RateLimitHeader = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After'
} as const;
