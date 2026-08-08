import { registerAs } from '@nestjs/config';

/**
 * Four attempts after the first, doubling from five seconds, spends roughly a
 * minute and a quarter on a delivery before giving up — long enough to ride out
 * an SMTP restart, short enough that a verification code has not expired by the
 * time the email lands.
 */
const DEFAULT_ATTEMPTS = 5;
const DEFAULT_BACKOFF_MS = 5_000;

/**
 * Completed jobs are kept only as a short delivery trail; failures are kept far
 * longer because they are the ones anyone will want to inspect.
 */
const DEFAULT_KEEP_COMPLETED = 100;
const DEFAULT_KEEP_FAILED = 1_000;

/**
 * Ceiling on how long publishing may block a request. ioredis buffers commands
 * while it reconnects, so without this an unreachable Redis would hold an HTTP
 * response open instead of dropping one email.
 */
const DEFAULT_PUBLISH_TIMEOUT_MS = 2_000;

const DEFAULT_ASSET_SYNC_INTERVAL_SECONDS = 3600;
const DEFAULT_ASSET_SYNC_ATTEMPTS = 4;
const DEFAULT_ASSET_SYNC_BACKOFF_MS = 60_000;
const DEFAULT_ASSET_SYNC_KEEP_COMPLETED = 10;
const DEFAULT_ASSET_SYNC_KEEP_FAILED = 50;

export default registerAs('queue', () => ({
  // Namespaces every BullMQ key, so several deployments can share one Redis
  // instance without consuming each other's jobs.
  prefix: process.env.QUEUE_PREFIX ?? 'bull',
  email: {
    attempts: Number(process.env.EMAIL_QUEUE_ATTEMPTS ?? DEFAULT_ATTEMPTS),
    backoffMs: Number(process.env.EMAIL_QUEUE_BACKOFF_MS ?? DEFAULT_BACKOFF_MS),
    keepCompleted: Number(
      process.env.EMAIL_QUEUE_KEEP_COMPLETED ?? DEFAULT_KEEP_COMPLETED
    ),
    keepFailed: Number(
      process.env.EMAIL_QUEUE_KEEP_FAILED ?? DEFAULT_KEEP_FAILED
    ),
    publishTimeoutMs: Number(
      process.env.EMAIL_QUEUE_PUBLISH_TIMEOUT_MS ?? DEFAULT_PUBLISH_TIMEOUT_MS
    )
  },
  assetSync: {
    intervalSeconds: Number(
      process.env.ASSET_SYNC_INTERVAL ?? DEFAULT_ASSET_SYNC_INTERVAL_SECONDS
    ),
    attempts: Number(
      process.env.ASSET_SYNC_QUEUE_ATTEMPTS ?? DEFAULT_ASSET_SYNC_ATTEMPTS
    ),
    backoffMs: Number(
      process.env.ASSET_SYNC_QUEUE_BACKOFF_MS ?? DEFAULT_ASSET_SYNC_BACKOFF_MS
    ),
    keepCompleted: Number(
      process.env.ASSET_SYNC_QUEUE_KEEP_COMPLETED ??
        DEFAULT_ASSET_SYNC_KEEP_COMPLETED
    ),
    keepFailed: Number(
      process.env.ASSET_SYNC_QUEUE_KEEP_FAILED ?? DEFAULT_ASSET_SYNC_KEEP_FAILED
    )
  }
}));
