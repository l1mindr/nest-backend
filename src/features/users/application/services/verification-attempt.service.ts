import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisCounterService } from '@infrastructure/databases/redis/redis-counter.service';
import { RedisService } from '@infrastructure/databases/redis/redis.service';
import { Injectable } from '@nestjs/common';
import {
  MAX_RESENDS_PER_HOUR,
  MAX_VERIFICATION_RATE_LIMIT,
  RESEND_HOURLY_WINDOW_MS,
  VERIFICATION_CODE_TTL_MS,
  VERIFICATION_RATE_LIMIT_WINDOW_MS,
  VERIFICATION_RESEND_COOLDOWN_MS
} from '../verification.constants';

@Injectable()
export class VerificationAttemptService {
  private static readonly ATTEMPT_TTL_SECONDS = VERIFICATION_CODE_TTL_MS / 1000;
  private static readonly RESEND_COOLDOWN_SECONDS =
    VERIFICATION_RESEND_COOLDOWN_MS / 1000;
  private static readonly RATE_LIMIT_WINDOW_SECONDS =
    VERIFICATION_RATE_LIMIT_WINDOW_MS / 1000;
  private static readonly RESEND_HOURLY_WINDOW_SECONDS =
    RESEND_HOURLY_WINDOW_MS / 1000;

  constructor(
    private readonly redisCounterService: RedisCounterService,
    private readonly redisService: RedisService
  ) {}

  async incrementFailedAttempt(userId: string): Promise<number> {
    return this.redisCounterService.increment(
      this.attemptsKey(userId),
      VerificationAttemptService.ATTEMPT_TTL_SECONDS
    );
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    await this.redisService.del(this.attemptsKey(userId));
  }

  async acquireResendCooldown(userId: string): Promise<boolean> {
    const result = await this.redisService.setIfNotExistsWithExpiry(
      this.cooldownKey(userId),
      '1',
      VerificationAttemptService.RESEND_COOLDOWN_SECONDS
    );

    return result === 'OK';
  }

  async isEmailRateLimitExceeded(normalizedEmail: string): Promise<boolean> {
    const count = await this.redisCounterService.increment(
      this.emailRateLimitKey(normalizedEmail),
      VerificationAttemptService.RATE_LIMIT_WINDOW_SECONDS
    );

    return count > MAX_VERIFICATION_RATE_LIMIT;
  }

  async isResendHourlyLimitExceeded(userId: string): Promise<boolean> {
    const count = await this.redisCounterService.increment(
      this.resendHourlyKey(userId),
      VerificationAttemptService.RESEND_HOURLY_WINDOW_SECONDS
    );

    return count > MAX_RESENDS_PER_HOUR;
  }

  private attemptsKey(userId: string): string {
    return `${RedisKey.VERIFY_ATTEMPTS}:${userId}`;
  }

  private cooldownKey(userId: string): string {
    return `${RedisKey.VERIFY_RESEND_COOLDOWN}:${userId}`;
  }

  private emailRateLimitKey(email: string): string {
    return `${RedisKey.VERIFY_EMAIL_RATE_LIMIT}:${email.trim().toLowerCase()}`;
  }

  private resendHourlyKey(userId: string): string {
    return `${RedisKey.VERIFY_RESEND_HOURLY}:${userId}`;
  }
}
