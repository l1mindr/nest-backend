export enum RedisKey {
  COIN_SYNC_LOCK = 'coin-tracker:sync:lock',
  PRICE_CHECK_LOCK = 'coin-tracker:price-check:lock',
  REFRESH_LOCK = 'refresh:lock',
  RATE_LIMIT = 'rate:limit',
  VERIFY_ATTEMPTS = 'verify:attempts',
  VERIFY_RESEND_COOLDOWN = 'verify:resend:cooldown'
}
