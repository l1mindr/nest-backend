import { registerAs } from '@nestjs/config';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 1_000;
// The Rial rate moves on exchange order flow rather than a published tick, so
// it is cached on the same order as the live coin tickers rather than the
// slower global-overview snapshot.
const DEFAULT_CACHE_TTL_MS = 60_000;

/**
 * Nobitex is an Iranian exchange; its public market endpoints need no key.
 * CoinGecko does not quote Rial, so this is a separate provider with its own
 * host, timeouts and cache — deliberately not folded into the CoinGecko
 * config, which would imply one upstream for both.
 *
 * Unit matters here: Iranian venues quote either Rial or Toman (1 Toman = 10
 * Rial). Nobitex's API exposes an `rls` (Rial) market, which is what this
 * provider asks for; the application serves Toman, so the reply is divided by
 * `rialPerToman`. That divisor is configurable so the assumption stays visible
 * and correctable without a code change — set it to 1 if the upstream is ever
 * found to be quoting Toman already.
 */
export default registerAs('nobitexUsdtToman', () => ({
  baseUrl: process.env.NOBITEX_BASE_URL ?? 'https://api.nobitex.ir',
  timeoutMs: Number(process.env.NOBITEX_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  retries: Number(process.env.NOBITEX_RETRIES ?? DEFAULT_RETRIES),
  backoffMs: Number(process.env.NOBITEX_BACKOFF_MS ?? DEFAULT_BACKOFF_MS),
  cacheTtlMs: Number(
    process.env.USDT_TOMAN_CACHE_TTL_MS ?? DEFAULT_CACHE_TTL_MS
  ),
  /** Rial per Toman. The venue's `rls` market is priced in Rial and the
   *  application serves Toman, so the provider divides by this. */
  rialPerToman: Number(process.env.RIAL_PER_TOMAN ?? 10)
}));
