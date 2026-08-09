import { registerAs } from '@nestjs/config';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 1_000;

export default registerAs('coingecko', () => ({
  baseUrl: process.env.COINGECKO_BASE_URL ?? 'https://api.coingecko.com/api/v3',
  apiKey: process.env.COINGECKO_API_KEY || null,
  pageSize: 250,
  maxPages: 5,
  timeoutMs: Number(process.env.COINGECKO_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  retries: Number(process.env.COINGECKO_RETRIES ?? DEFAULT_RETRIES),
  backoffMs: Number(process.env.COINGECKO_BACKOFF_MS ?? DEFAULT_BACKOFF_MS)
}));
