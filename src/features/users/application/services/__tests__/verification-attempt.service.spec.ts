import { RedisCounterService } from '@infrastructure/databases/redis/redis-counter.service';
import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisService } from '@infrastructure/databases/redis/redis.service';
import { VerificationAttemptService } from '../verification-attempt.service';
import {
  VERIFICATION_CODE_TTL_MS,
  VERIFICATION_RESEND_COOLDOWN_MS
} from '../../verification.constants';

describe('VerificationAttemptService', () => {
  let service: VerificationAttemptService;

  const mockRedisCounterService = {
    increment: jest.fn()
  };

  const mockRedisService = {
    del: jest.fn(),
    setIfNotExistsWithExpiry: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VerificationAttemptService(
      mockRedisCounterService as unknown as RedisCounterService,
      mockRedisService as unknown as RedisService
    );
  });

  describe('incrementFailedAttempt', () => {
    it('should increment the per-user attempts counter with the code TTL', async () => {
      mockRedisCounterService.increment.mockResolvedValue(3);

      const result = await service.incrementFailedAttempt('user-id');

      expect(result).toBe(3);
      expect(mockRedisCounterService.increment).toHaveBeenCalledWith(
        `${RedisKey.VERIFY_ATTEMPTS}:user-id`,
        VERIFICATION_CODE_TTL_MS / 1000
      );
    });
  });

  describe('resetFailedAttempts', () => {
    it('should delete the per-user attempts counter', async () => {
      await service.resetFailedAttempts('user-id');

      expect(mockRedisService.del).toHaveBeenCalledWith(
        `${RedisKey.VERIFY_ATTEMPTS}:user-id`
      );
    });
  });

  describe('acquireResendCooldown', () => {
    it('should return true when the cooldown key is acquired', async () => {
      mockRedisService.setIfNotExistsWithExpiry.mockResolvedValue('OK');

      const result = await service.acquireResendCooldown('user-id');

      expect(result).toBe(true);
      expect(mockRedisService.setIfNotExistsWithExpiry).toHaveBeenCalledWith(
        `${RedisKey.VERIFY_RESEND_COOLDOWN}:user-id`,
        '1',
        VERIFICATION_RESEND_COOLDOWN_MS / 1000
      );
    });

    it('should return false when the cooldown is already active', async () => {
      mockRedisService.setIfNotExistsWithExpiry.mockResolvedValue(null);

      const result = await service.acquireResendCooldown('user-id');

      expect(result).toBe(false);
    });
  });
});
