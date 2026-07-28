import { ISessionRevocationUseCase } from '@features/sessions/application/interfaces/sessions.interface';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../../../entities/user.entity';
import { UserErrors } from '../../../errors/user-errors';
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
      mockDataSource as unknown as DataSource
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
  });
});
