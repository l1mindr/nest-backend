import { TokenErrors } from '@features/token/errors/token-errors';
import { DataSource, EntityManager } from 'typeorm';
import { AuthErrors } from '../errors/auth-errors';
import { ChangePasswordService } from './change-password.service';

describe('ChangePasswordService', () => {
  let service: ChangePasswordService;

  const mockHashingProvider = {
    compare: jest.fn(),
    hash: jest.fn()
  };

  const mockUsersService = {
    findByIdWithPassword: jest.fn(),
    setPassword: jest.fn()
  };

  const mockTerminateOtherSessionsService = {
    terminateOthers: jest.fn()
  };

  const mockTransactionManager = {} as EntityManager;

  const mockDataSource = {
    transaction: jest.fn(
      async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback(mockTransactionManager)
    )
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ChangePasswordService(
      mockHashingProvider as any,
      mockUsersService as any,
      mockTerminateOtherSessionsService as any,
      mockDataSource as unknown as DataSource,
      mockLogger as any
    );
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      mockUsersService.findByIdWithPassword.mockResolvedValue({
        id: 'user-id',
        password: 'old-hash'
      });

      mockHashingProvider.compare
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      mockHashingProvider.hash.mockResolvedValue('new-hash');

      await service.changePassword('user-id', 'session-id', {
        currentPassword: 'old-password',
        newPassword: 'new-password'
      });

      expect(mockUsersService.setPassword).toHaveBeenCalledWith(
        'user-id',
        'new-hash',
        mockTransactionManager
      );

      expect(
        mockTerminateOtherSessionsService.terminateOthers
      ).toHaveBeenCalledWith('user-id', 'session-id', mockTransactionManager);
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('should fail the transaction when session revocation fails', async () => {
      const error = new Error('session update failed');

      mockUsersService.findByIdWithPassword.mockResolvedValue({
        id: 'user-id',
        password: 'old-hash'
      });
      mockHashingProvider.compare
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      mockHashingProvider.hash.mockResolvedValue('new-hash');
      mockTerminateOtherSessionsService.terminateOthers.mockRejectedValueOnce(
        error
      );

      await expect(
        service.changePassword('user-id', 'session-id', {
          currentPassword: 'old-password',
          newPassword: 'new-password'
        })
      ).rejects.toEqual(AuthErrors.passwordChangeFailed());

      expect(mockUsersService.setPassword).toHaveBeenCalledWith(
        'user-id',
        'new-hash',
        mockTransactionManager
      );
      expect(
        mockTerminateOtherSessionsService.terminateOthers
      ).toHaveBeenCalledWith('user-id', 'session-id', mockTransactionManager);
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: 'password.changed' }),
        expect.any(String)
      );
    });

    it('should throw when user not found', async () => {
      mockUsersService.findByIdWithPassword.mockResolvedValue(null);

      await expect(
        service.changePassword('user-id', 'session-id', {
          currentPassword: 'old',
          newPassword: 'new'
        })
      ).rejects.toEqual(TokenErrors.invalidToken());
    });

    it('should throw invalidCurrentPassword', async () => {
      mockUsersService.findByIdWithPassword.mockResolvedValue({
        password: 'hash'
      });

      mockHashingProvider.compare.mockResolvedValue(false);

      await expect(
        service.changePassword('user-id', 'session-id', {
          currentPassword: 'wrong',
          newPassword: 'new'
        })
      ).rejects.toEqual(AuthErrors.invalidCurrentPassword());
    });

    it('should throw passwordMustBeDifferent', async () => {
      mockUsersService.findByIdWithPassword.mockResolvedValue({
        password: 'hash'
      });

      mockHashingProvider.compare
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await expect(
        service.changePassword('user-id', 'session-id', {
          currentPassword: 'old',
          newPassword: 'old'
        })
      ).rejects.toEqual(AuthErrors.passwordMustBeDifferent());
    });
  });
});
