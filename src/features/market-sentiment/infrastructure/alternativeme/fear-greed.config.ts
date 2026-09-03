import { registerAs } from '@nestjs/config';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 1_000;
// The Fear & Greed Index is published roughly once a day upstream (the
// response itself reports `time_until_update`), so a much longer cache
// window than the market-overview cache is safe. Still short enough (well
// under the actual daily update cadence) that a newly-published index is
// visible within a few polling cycles rather than up to a stale hour.
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

export default registerAs('fearGreed', () => ({
  baseUrl: process.env.FEAR_GREED_BASE_URL ?? 'https://api.alternative.me/fng',
  timeoutMs: Number(process.env.FEAR_GREED_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  retries: Number(process.env.FEAR_GREED_RETRIES ?? DEFAULT_RETRIES),
  backoffMs: Number(process.env.FEAR_GREED_BACKOFF_MS ?? DEFAULT_BACKOFF_MS),
  cacheTtlMs: Number(
    process.env.FEAR_GREED_CACHE_TTL_MS ?? DEFAULT_CACHE_TTL_MS
  )
}));
