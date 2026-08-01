import { ClockService } from '@infrastructure/clock/clock.service';
import { ConfigService } from '@nestjs/config';
import { VerificationCodeService } from '../verification-code.service';

describe('VerificationCodeService', () => {
  let service: VerificationCodeService;

  const mockClockService = {
    nowDate: jest.fn()
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(4)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VerificationCodeService(
      mockClockService as unknown as ClockService,
      mockConfigService as unknown as ConfigService
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
      const expiresAt = new Date('2024-01-01T00:03:00Z');
      mockClockService.nowDate.mockReturnValue(
        new Date('2024-01-01T00:02:00Z')
      );

      const result = service.isExpired(expiresAt);

      expect(result).toBe(false);
    });

    it('should return false at exact expiry boundary', () => {
      const expiresAt = new Date('2024-01-01T00:03:00Z');
      mockClockService.nowDate.mockReturnValue(expiresAt);

      const result = service.isExpired(expiresAt);

      expect(result).toBe(false);
    });

    it('should return true when code is expired', () => {
      const expiresAt = new Date('2024-01-01T00:03:00Z');
      mockClockService.nowDate.mockReturnValue(
        new Date('2024-01-01T00:03:00Z').getTime() + 1
      );

      const result = service.isExpired(expiresAt);

      expect(result).toBe(true);
    });
  });
});
