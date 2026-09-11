import { registerAs } from '@nestjs/config';
import { RIAL_PER_TOMAN } from '../usdt-toman/usdt-toman.normalizer';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 1_000;

/**
 * Nobitex's public API host.
 *
 * `api.nobitex.ir` — the host this defaulted to until it was found to be the
 * cause of the outage — does not exist: it is NXDOMAIN on every public
 * resolver, while `nobitex.ir`, `www.nobitex.ir` and `apiv2.nobitex.ir` all
 * resolve. Every rate fetch therefore failed at DNS. `apiv2.nobitex.ir` is the
 * host that actually serves `/market/stats`.
 */
const DEFAULT_BASE_URL = 'https://apiv2.nobitex.ir';

/**
 * Nobitex is an Iranian exchange; its public market endpoints need no key.
 * CoinGecko does not quote Rial, so this is a separate provider with its own
 * host and timeouts — deliberately not folded into the CoinGecko config, which
 * would imply one upstream for both.
 *
 * Unit matters here: Iranian venues quote either Rial or Toman (1 Toman = 10
 * Rial). Nobitex's API exposes an `rls` (Rial) market, which is what this
 * provider asks for; the application serves Toman, so the reply is divided by
 * `rialPerToman`. That divisor is configurable so the assumption stays visible
 * and correctable without a code change — set it to 1 if the upstream is ever
 * found to be quoting Toman already. It is a decimal *string* because the
 * conversion runs through the exact decimal helpers, not float division.
 *
 * The cache TTL is not here: the cache sits above the failover chain and is
 * shared with Wallex, so it lives in `usdt-toman/usdt-toman.config.ts`.
 */
export default registerAs('nobitexUsdtToman', () => ({
  baseUrl: process.env.NOBITEX_BASE_URL ?? DEFAULT_BASE_URL,
  timeoutMs: Number(process.env.NOBITEX_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  retries: Number(process.env.NOBITEX_RETRIES ?? DEFAULT_RETRIES),
  backoffMs: Number(process.env.NOBITEX_BACKOFF_MS ?? DEFAULT_BACKOFF_MS),
  /** Rial per Toman. The venue's `rls` market is priced in Rial and the
   *  application serves Toman, so the provider divides by this. */
  rialPerToman: process.env.RIAL_PER_TOMAN ?? RIAL_PER_TOMAN
}));
