import { TimeConstants } from '@infrastructure/clock/time.constants';

export const VERIFICATION_CODE_TTL_MS = 3 * TimeConstants.MS_PER_MINUTE;
export const VERIFICATION_CODE_TTL_MINUTES =
  VERIFICATION_CODE_TTL_MS / TimeConstants.MS_PER_MINUTE;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * TimeConstants.MS_PER_SECOND;
export const MAX_VERIFICATION_ATTEMPTS = 5;

export const VERIFICATION_RATE_LIMIT_WINDOW_MS =
  10 * TimeConstants.MS_PER_MINUTE;
export const MAX_VERIFICATION_RATE_LIMIT = 5;

export const RESEND_HOURLY_WINDOW_MS = TimeConstants.MS_PER_HOUR;
export const MAX_RESENDS_PER_HOUR = 5;
