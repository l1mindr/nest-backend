import { registerAs } from '@nestjs/config';

const DEFAULT_BASE_URL = 'https://api.wallex.ir';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 1_000;

/**
 * Wallex is the second Iranian exchange behind the USDT/Toman rate, used as
 * the fallback when Nobitex is preferred and as the primary when
 * `USDT_TOMAN_PROVIDER=wallex`. Its public market endpoint needs no key.
 *
 * There is deliberately no unit divisor here, unlike the Nobitex config:
 * Wallex's `USDTTMN` market is quoted in Toman already (`quoteAsset: "TMN"`,
 * `enQuoteAsset: "Toman"`), so the adapter converts by the identity rather
 * than dividing. Adding a configurable divisor would invite someone to "fix"
 * a discrepancy by scaling a value that is already correct.
 */
export default registerAs('wallexUsdtToman', () => ({
  baseUrl: process.env.WALLEX_BASE_URL ?? DEFAULT_BASE_URL,
  timeoutMs: Number(process.env.WALLEX_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  retries: Number(process.env.WALLEX_RETRIES ?? DEFAULT_RETRIES),
  backoffMs: Number(process.env.WALLEX_BACKOFF_MS ?? DEFAULT_BACKOFF_MS)
}));
