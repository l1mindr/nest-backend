import { ClockService } from '@infrastructure/clock/clock.service';
import { TimeConstants } from '@infrastructure/clock/time.constants';
import { VerificationCodeService } from '../verification-code.service';

describe('VerificationCodeService', () => {
  let service: VerificationCodeService;

  const mockClockService = {
    nowDate: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VerificationCodeService(
      mockClockService as unknown as ClockService
    );
  });

  describe('generate', () => {
    it('should return a 6-digit code', () => {
      const code = service.generate();

      expect(code).toMatch(/^\d{6}$/);
    });
  });

  describe('hash and validate', () => {
    it('should validate correct code', async () => {
      const code = '123456';
      const hash = await service.hash(code);

      const result = await service.validate(code, hash);

      expect(result).toBe(true);
    });

    it('should reject incorrect code', async () => {
      const hash = await service.hash('123456');

      const result = await service.validate('wrong-code', hash);

      expect(result).toBe(false);
    });
  });

  describe('isExpired', () => {
    it('should return false when code is not expired', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      mockClockService.nowDate.mockReturnValue(
        new Date(createdAt.getTime() + 2 * TimeConstants.MS_PER_MINUTE)
      );

      const result = service.isExpired(createdAt);

      expect(result).toBe(false);
    });

    it('should return false at exact 3-minute boundary', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const exactlyAtBoundary =
        createdAt.getTime() + 3 * TimeConstants.MS_PER_MINUTE;

      mockClockService.nowDate.mockReturnValue(new Date(exactlyAtBoundary));

      const result = service.isExpired(createdAt);

      expect(result).toBe(false);
    });

    it('should return true when code is expired', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const expiredAt =
        createdAt.getTime() + 3 * TimeConstants.MS_PER_MINUTE + 1;

      mockClockService.nowDate.mockReturnValue(new Date(expiredAt));

      const result = service.isExpired(createdAt);

      expect(result).toBe(true);
    });
  });
});
