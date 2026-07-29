import { ClockService } from '@infrastructure/clock/clock.service';
import { UserStatus } from '../../../domain/enums/user-status.enum';
import { CleanupPendingUsersUseCase } from '../cleanup-pending-users.use-case';

describe('CleanupPendingUsersUseCase', () => {
  let useCase: CleanupPendingUsersUseCase;

  const mockUserRepository = {
    findPendingOlderThan: jest.fn(),
    updateStatus: jest.fn()
  };

  const mockVerificationCodeRepository = {
    invalidatePreviousCodes: jest.fn()
  };

  const mockClockService = {
    nowDate: jest.fn()
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  };

  const NOW = new Date('2024-01-15T12:00:00Z');

  const oldPendingUser = {
    id: 'user-1',
    email: 'old@test.com',
    status: UserStatus.PENDING_VERIFICATION,
    registryDates: {
      createdAt: new Date('2024-01-10T12:00:00Z')
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClockService.nowDate.mockReturnValue(NOW);

    useCase = new CleanupPendingUsersUseCase(
      mockUserRepository as any,
      mockVerificationCodeRepository as any,
      mockClockService as unknown as ClockService,
      mockLogger as any
    );
  });

  describe('execute', () => {
    it('should deactivate pending users older than 24 hours', async () => {
      mockUserRepository.findPendingOlderThan.mockResolvedValue([
        oldPendingUser
      ]);

      await useCase.execute();

      expect(mockUserRepository.findPendingOlderThan).toHaveBeenCalledWith(
        expect.any(Date)
      );

      expect(
        mockVerificationCodeRepository.invalidatePreviousCodes
      ).toHaveBeenCalledWith('user-1', NOW);

      expect(mockUserRepository.updateStatus).toHaveBeenCalledWith(
        'user-1',
        UserStatus.DEACTIVATE
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1'
        }),
        expect.any(String)
      );
    });

    it('should handle multiple pending users', async () => {
      const user2 = {
        id: 'user-2',
        email: 'old2@test.com',
        status: UserStatus.PENDING_VERIFICATION,
        registryDates: {
          createdAt: new Date('2024-01-08T12:00:00Z')
        }
      };

      mockUserRepository.findPendingOlderThan.mockResolvedValue([
        oldPendingUser,
        user2
      ]);

      await useCase.execute();

      expect(
        mockVerificationCodeRepository.invalidatePreviousCodes
      ).toHaveBeenCalledTimes(2);
      expect(mockUserRepository.updateStatus).toHaveBeenCalledTimes(2);
    });

    it('should skip when no pending users older than 24 hours', async () => {
      mockUserRepository.findPendingOlderThan.mockResolvedValue([]);

      await useCase.execute();

      expect(
        mockVerificationCodeRepository.invalidatePreviousCodes
      ).not.toHaveBeenCalled();
      expect(mockUserRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should use ClockService for time calculation', async () => {
      mockUserRepository.findPendingOlderThan.mockResolvedValue([
        oldPendingUser
      ]);

      await useCase.execute();

      expect(mockClockService.nowDate).toHaveBeenCalledTimes(1);

      const cutoffArg =
        mockUserRepository.findPendingOlderThan.mock.calls[0][0];
      const expectedCutoff = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
      expect(cutoffArg.getTime()).toBe(expectedCutoff.getTime());
    });

    it('should log completion with deactivated count', async () => {
      mockUserRepository.findPendingOlderThan.mockResolvedValue([
        oldPendingUser
      ]);

      await useCase.execute();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          deactivatedCount: 1
        }),
        expect.any(String)
      );
    });
  });
});
