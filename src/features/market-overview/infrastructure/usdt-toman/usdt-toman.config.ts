import { registerAs } from '@nestjs/config';

/**
 * Every exchange adapter that can serve the USDT/Toman rate, in the order the
 * failover chain walks them once the preferred one is moved to the front.
 * Declaring the order here rather than deriving it from DI registration is
 * what makes the fallback deterministic.
 */
export const USDT_TOMAN_PROVIDERS = ['nobitex', 'wallex'] as const;

export type UsdtTomanProviderName = (typeof USDT_TOMAN_PROVIDERS)[number];

export const DEFAULT_USDT_TOMAN_PROVIDER: UsdtTomanProviderName = 'nobitex';

// The Toman rate moves on exchange order flow rather than a published tick, so
// it is cached on the same order as the live coin tickers rather than the
// slower global-overview snapshot. The cache sits above the failover chain, so
// it is shared by both venues and belongs here rather than in either adapter's
// own config.
const DEFAULT_CACHE_TTL_MS = 60_000;

/**
 * Provider-neutral settings for the USDT/Toman rate: which venue is preferred
 * and how long a fetched rate is served for. The per-venue hosts, timeouts and
 * unit divisors live in each adapter's own config alongside the adapter.
 *
 * `USDT_TOMAN_PROVIDER` accepts exactly the values in
 * {@link USDT_TOMAN_PROVIDERS}; anything else fails startup validation in
 * `env.schema.ts` rather than silently picking a venue.
 */
export default registerAs('usdtToman', () => ({
  provider: (process.env.USDT_TOMAN_PROVIDER ??
    DEFAULT_USDT_TOMAN_PROVIDER) as UsdtTomanProviderName,
  cacheTtlMs: Number(
    process.env.USDT_TOMAN_CACHE_TTL_MS ?? DEFAULT_CACHE_TTL_MS
  )
}));
