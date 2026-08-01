import { TimeConstants } from '@infrastructure/clock/time.constants';

export const VERIFICATION_CODE_TTL_MS = 3 * TimeConstants.MS_PER_MINUTE;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * TimeConstants.MS_PER_SECOND;
export const MAX_VERIFICATION_ATTEMPTS = 5;
