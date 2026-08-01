import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisCounterService } from '@infrastructure/databases/redis/redis-counter.service';
import { RedisService } from '@infrastructure/databases/redis/redis.service';
import { Injectable } from '@nestjs/common';
import {
  VERIFICATION_CODE_TTL_MS,
  VERIFICATION_RESEND_COOLDOWN_MS
} from '../verification.constants';

@Injectable()
export class VerificationAttemptService {
  private static readonly ATTEMPT_TTL_SECONDS = VERIFICATION_CODE_TTL_MS / 1000;
  private static readonly RESEND_COOLDOWN_SECONDS =
    VERIFICATION_RESEND_COOLDOWN_MS / 1000;

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

  private attemptsKey(userId: string): string {
    return `${RedisKey.VERIFY_ATTEMPTS}:${userId}`;
  }

  private cooldownKey(userId: string): string {
    return `${RedisKey.VERIFY_RESEND_COOLDOWN}:${userId}`;
  }
}
