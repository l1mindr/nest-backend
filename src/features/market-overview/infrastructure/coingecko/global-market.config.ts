import { registerAs } from '@nestjs/config';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 1_000;
const DEFAULT_CACHE_TTL_MS = 90_000;
// Shorter than the global-overview cache: the BTC price card is the most
// time-sensitive of the three market widgets, and this is exactly the value
// the Dashboard previously (incorrectly) sourced from the hourly asset-sync
// snapshot instead of a live call.
const DEFAULT_BITCOIN_CACHE_TTL_MS = 30_000;

/**
 * Reuses the same CoinGecko host/API key as the `assets` feature (it is the
 * same provider, just different endpoints): `/global` for the market
 * overview, `/simple/price` for the live Bitcoin ticker. Each gets its own
 * cache TTL since they have different freshness needs, but share the same
 * timeout/retry knobs and HTTP client configuration.
 */
export default registerAs('coingeckoGlobal', () => ({
  baseUrl: process.env.COINGECKO_BASE_URL ?? 'https://api.coingecko.com/api/v3',
  apiKey: process.env.COINGECKO_API_KEY || null,
  timeoutMs: Number(process.env.COINGECKO_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  retries: Number(process.env.COINGECKO_RETRIES ?? DEFAULT_RETRIES),
  backoffMs: Number(process.env.COINGECKO_BACKOFF_MS ?? DEFAULT_BACKOFF_MS),
  cacheTtlMs: Number(
    process.env.MARKET_OVERVIEW_CACHE_TTL_MS ?? DEFAULT_CACHE_TTL_MS
  ),
  bitcoinCacheTtlMs: Number(
    process.env.BITCOIN_MARKET_CACHE_TTL_MS ?? DEFAULT_BITCOIN_CACHE_TTL_MS
  )
}));
