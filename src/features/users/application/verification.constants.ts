import { TimeConstants } from '@infrastructure/clock/time.constants';

/**
 * Lifetime of a verification code.
 *
 * The attempt allowance, the resend cooldown, and the hourly resend budget that
 * used to live here are now policies in
 * `@features/security/rate-limit/config/rate-limit.config`, so every limit in
 * the application is declared in one place.
 */
export const VERIFICATION_CODE_TTL_MS = 3 * TimeConstants.MS_PER_MINUTE;
export const VERIFICATION_CODE_TTL_MINUTES =
  VERIFICATION_CODE_TTL_MS / TimeConstants.MS_PER_MINUTE;
