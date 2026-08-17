import { AuthorizationErrorCode } from '@features/authorization/domain/errors/authorization-error-code.enum';
import { ISessionRevocationUseCase } from '@features/sessions/application/interfaces/sessions.interface';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../../../domain/entities/user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { UserErrors } from '../../../domain/errors/user-errors';
import { DeleteAccountUseCase } from '../../use-cases/delete-account.use-case';

describe('DeleteAccountUseCase', () => {
  let service: DeleteAccountUseCase;

  const mockUserRepository = {
    findUserById: jest.fn()
  };

  const mockRepository = {
    softRemove: jest.fn()
  };

  const mockTransactionManager = {
    getRepository: jest.fn().mockReturnValue(mockRepository)
  };

  const mockRevocationUseCase = {
    revokeAll: jest.fn()
  };

  const mockDataSource = {
    transaction: jest.fn(
      async (cb: (manager: EntityManager) => Promise<unknown>) =>
        cb(mockTransactionManager as unknown as EntityManager)
    )
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionManager.getRepository.mockReturnValue(mockRepository);

    service = new DeleteAccountUseCase(
      mockUserRepository as any,
      mockRevocationUseCase as unknown as ISessionRevocationUseCase,
      mockDataSource as unknown as DataSource,
      { record: jest.fn() } as any
    );
  });

  describe('execute', () => {
    it('should soft delete user and revoke all sessions in one transaction', async () => {
      const user = { id: '1' } as User;
      mockUserRepository.findUserById.mockResolvedValue(user);

      await service.execute('1');

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepository.softRemove).toHaveBeenCalledWith(user);
      expect(mockRevocationUseCase.revokeAll).toHaveBeenCalledWith(
        '1',
        mockTransactionManager
      );
    });

    it('should throw when user does not exist', async () => {
      mockUserRepository.findUserById.mockResolvedValue(null);

      await expect(service.execute('1')).rejects.toEqual(
        UserErrors.userNotFound('1')
      );

      expect(mockRepository.softRemove).not.toHaveBeenCalled();
      expect(mockRevocationUseCase.revokeAll).not.toHaveBeenCalled();
    });

    it('should propagate transaction failures', async () => {
      const user = { id: '1' } as User;
      const error = new Error('db down');

      mockUserRepository.findUserById.mockResolvedValue(user);
      mockRepository.softRemove.mockRejectedValue(error);

      await expect(service.execute('1')).rejects.toThrow(error);
    });

    /**
     * The owner is refused even on their own account: the system must always
     * have exactly one, and no endpoint can appoint a replacement afterwards.
     */
    it('should refuse to delete the owner', async () => {
      mockUserRepository.findUserById.mockResolvedValue({
        id: 'owner-1',
        role: UserRole.OWNER
      } as User);

      await expect(service.execute('owner-1')).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.OWNER_IMMUTABLE,
          statusCode: 403
        })
      );

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockRepository.softRemove).not.toHaveBeenCalled();
      expect(mockRevocationUseCase.revokeAll).not.toHaveBeenCalled();
    });

    it('should allow an administrator to delete their own account', async () => {
      const user = { id: 'admin-1', role: UserRole.ADMIN } as User;
      mockUserRepository.findUserById.mockResolvedValue(user);
      // `clearAllMocks` resets calls but not implementations, so the rejection
      // installed by the failure case above would otherwise carry over.
      mockRepository.softRemove.mockResolvedValue(user);

      await service.execute('admin-1');

      expect(mockRepository.softRemove).toHaveBeenCalledWith(user);
    });
  });
});
