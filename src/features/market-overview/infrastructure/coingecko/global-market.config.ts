import { registerAs } from '@nestjs/config';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 1_000;
const DEFAULT_CACHE_TTL_MS = 90_000;

/**
 * Reuses the same CoinGecko host/API key as the `assets` feature (it is the
 * same provider, just a different endpoint), with its own timeout/retry/cache
 * knobs since `/global` is a single lightweight call rather than a paginated
 * sync.
 */
export default registerAs('coingeckoGlobal', () => ({
  baseUrl: process.env.COINGECKO_BASE_URL ?? 'https://api.coingecko.com/api/v3',
  apiKey: process.env.COINGECKO_API_KEY || null,
  timeoutMs: Number(process.env.COINGECKO_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  retries: Number(process.env.COINGECKO_RETRIES ?? DEFAULT_RETRIES),
  backoffMs: Number(process.env.COINGECKO_BACKOFF_MS ?? DEFAULT_BACKOFF_MS),
  cacheTtlMs: Number(
    process.env.MARKET_OVERVIEW_CACHE_TTL_MS ?? DEFAULT_CACHE_TTL_MS
  )
}));
