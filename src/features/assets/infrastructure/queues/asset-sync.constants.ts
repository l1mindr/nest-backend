export const ASSET_SYNC_QUEUE = 'asset-sync';
export const ASSET_SYNC_JOB = 'sync';

/**
 * Deduplicates manually triggered sync jobs in BullMQ: while one manual sync
 * is pending or running, a second trigger is a no-op instead of stacking a
 * second CoinGecko run behind the first.
 */
export const ASSET_SYNC_MANUAL_DEDUPE_ID = 'manual-asset-sync';

export const ASSET_WORKER_CONCURRENCY = 1;
