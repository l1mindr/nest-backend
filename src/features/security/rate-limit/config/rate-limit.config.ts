import { TimeConstants } from '@infrastructure/clock/time.constants';
import { RateLimitIdentifier } from '../types/rate-limit-identifier.enum';
import {
  RateLimitPolicyGroup,
  RateLimitPolicyTree
} from '../types/rate-limit-rule.interface';

const SECONDS = TimeConstants.MS_PER_SECOND;
const MINUTES = TimeConstants.MS_PER_MINUTE;
const HOURS = TimeConstants.MS_PER_HOUR;

/**
 * Every rate limit in the application. Nothing outside this file may hardcode a
 * limit or a window — changing a value here changes it everywhere.
 *
 * `as const satisfies RateLimitPolicyTree` does two jobs at once:
 *  - `satisfies` type-checks every rule against `RateLimitRule` where it is
 *    written, so a typo or a missing `failOpen` is a compile error here rather
 *    than a silently unlimited route at runtime;
 *  - `as const` preserves the literal types, so `RateLimitPolicies.Auth.Login.IP`
 *    autocompletes and narrows to that exact rule instead of widening.
 *
 * Rules within a group are ordered broadest dimension first (IP, then device,
 * then body-derived), because evaluation is fail-fast and stops at the first
 * denial.
 */
export const RateLimitPolicies = {
  Auth: {
    Register: {
      IP: {
        name: 'auth.register.ip',
        identifier: RateLimitIdentifier.IP,
        keyPrefix: 'register',
        limit: 5,
        windowMs: 60 * SECONDS,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      },
      Device: {
        name: 'auth.register.device',
        identifier: RateLimitIdentifier.DEVICE,
        keyPrefix: 'register',
        limit: 10,
        windowMs: 60 * SECONDS,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      }
    },

    Login: {
      IP: {
        name: 'auth.login.ip',
        identifier: RateLimitIdentifier.IP,
        keyPrefix: 'login',
        limit: 5,
        windowMs: 60 * SECONDS,
        // Deliberately no block: an address-wide penalty box punishes every
        // user behind one NAT for a single attacker.
        blockDurationMs: 0,
        enabled: true,
        failOpen: false
      },
      Email: {
        name: 'auth.login.email',
        identifier: RateLimitIdentifier.EMAIL,
        keyPrefix: 'login',
        // 10 rather than 5 so a real user fumbling their password stays clear
        // of the block; only failures accumulate, successes reset the counter.
        limit: 10,
        windowMs: 15 * MINUTES,
        blockDurationMs: 15 * MINUTES,
        enabled: true,
        failOpen: false
      },
      Device: {
        name: 'auth.login.device',
        identifier: RateLimitIdentifier.DEVICE,
        keyPrefix: 'login',
        limit: 10,
        windowMs: 60 * SECONDS,
        blockDurationMs: 5 * MINUTES,
        enabled: true,
        failOpen: false
      }
    },

    Verify: {
      IP: {
        name: 'auth.verify.ip',
        identifier: RateLimitIdentifier.IP,
        keyPrefix: 'verify',
        limit: 10,
        windowMs: 60 * SECONDS,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      },
      Device: {
        name: 'auth.verify.device',
        identifier: RateLimitIdentifier.DEVICE,
        keyPrefix: 'verify',
        limit: 10,
        windowMs: 60 * SECONDS,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      },
      Email: {
        name: 'auth.verify.email',
        identifier: RateLimitIdentifier.EMAIL,
        keyPrefix: 'verify',
        limit: 5,
        windowMs: 10 * MINUTES,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      },
      Code: {
        name: 'auth.verify.code',
        identifier: RateLimitIdentifier.VERIFICATION_CODE,
        keyPrefix: 'verify',
        // Keyed on the code alone and counted separately from the email
        // dimension, so fixing one code and sweeping many addresses — the
        // birthday attack against six-digit codes — is capped regardless of how
        // many addresses or IPs the attacker rotates through.
        limit: 20,
        windowMs: 10 * MINUTES,
        blockDurationMs: 0,
        enabled: true,
        failOpen: false
      }
    },

    Resend: {
      IP: {
        name: 'auth.resend.ip',
        identifier: RateLimitIdentifier.IP,
        keyPrefix: 'resend',
        limit: 5,
        windowMs: 60 * SECONDS,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      },
      Device: {
        name: 'auth.resend.device',
        identifier: RateLimitIdentifier.DEVICE,
        keyPrefix: 'resend',
        limit: 10,
        windowMs: 60 * SECONDS,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      },
      Email: {
        name: 'auth.resend.email',
        identifier: RateLimitIdentifier.EMAIL,
        keyPrefix: 'resend',
        limit: 10,
        windowMs: HOURS,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      }
    },

    Refresh: {
      IP: {
        name: 'auth.refresh.ip',
        identifier: RateLimitIdentifier.IP,
        keyPrefix: 'refresh',
        limit: 20,
        windowMs: 60 * SECONDS,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      },
      Device: {
        name: 'auth.refresh.device',
        identifier: RateLimitIdentifier.DEVICE,
        keyPrefix: 'refresh',
        limit: 20,
        windowMs: 60 * SECONDS,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      }
    },

    ChangePassword: {
      IP: {
        name: 'auth.changePassword.ip',
        identifier: RateLimitIdentifier.IP,
        keyPrefix: 'password',
        limit: 3,
        windowMs: 5 * MINUTES,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      },
      User: {
        name: 'auth.changePassword.user',
        identifier: RateLimitIdentifier.USER,
        keyPrefix: 'password',
        limit: 3,
        windowMs: 5 * MINUTES,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      }
    }
  },

  CoinTracker: {
    Alert: {
      IP: {
        name: 'coinTracker.alert.ip',
        identifier: RateLimitIdentifier.IP,
        keyPrefix: 'alert',
        limit: 30,
        windowMs: 60 * SECONDS,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      },
      User: {
        name: 'coinTracker.alert.user',
        identifier: RateLimitIdentifier.USER,
        keyPrefix: 'alert',
        limit: 30,
        windowMs: 60 * SECONDS,
        blockDurationMs: 0,
        enabled: true,
        failOpen: true
      }
    }
  }
} as const satisfies RateLimitPolicyTree;

/**
 * Rules consumed imperatively from a use case rather than by the guard, because
 * the caller has to react to the outcome — invalidate a code, skip a send —
 * instead of answering 429.
 */
export const ImperativeRateLimitPolicies = {
  /**
   * Failed verification attempts for one user. Reaching the limit invalidates
   * the outstanding code. The window matches the code's own lifetime, so a
   * fresh code always starts from a clean slate.
   */
  VerificationAttempts: {
    name: 'auth.verify.attempts',
    identifier: RateLimitIdentifier.USER,
    keyPrefix: 'verify:attempts',
    limit: 5,
    windowMs: 3 * MINUTES,
    blockDurationMs: 0,
    enabled: true,
    failOpen: true
  },
  ResendHourly: {
    name: 'auth.resend.hourly',
    identifier: RateLimitIdentifier.USER,
    keyPrefix: 'resend:hourly',
    limit: 5,
    windowMs: HOURS,
    blockDurationMs: 0,
    enabled: true,
    failOpen: true
  },
  /**
   * A one-per-minute cooldown. `limit: 1` reproduces `SET NX EX 60` exactly:
   * the first call increments to 1 and arms the TTL, the second increments to 2
   * without re-arming it, so the cooldown never slides forward under repeated
   * attempts.
   */
  ResendCooldown: {
    name: 'auth.resend.cooldown',
    identifier: RateLimitIdentifier.USER,
    keyPrefix: 'resend:cooldown',
    limit: 1,
    windowMs: 60 * SECONDS,
    blockDurationMs: 0,
    enabled: true,
    failOpen: true
  }
} as const satisfies RateLimitPolicyGroup;
