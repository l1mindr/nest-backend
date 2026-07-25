import { DataSource, EntityManager } from 'typeorm';
import { Session } from '../entities/session.entity';
import { RevokeAllUserSessionsService } from './revoke-all-user-sessions.service';

describe('RevokeAllUserSessionsService', () => {
  let service: RevokeAllUserSessionsService;

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const mockRepository = {
    update: jest.fn()
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockRepository)
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new RevokeAllUserSessionsService(
      mockDataSource as unknown as DataSource,
      mockLogger as any
    );
  });

  describe('revokeAllForUser', () => {
    it('should revoke every active session belonging to the user', async () => {
      mockRepository.update.mockResolvedValue(undefined);

      await service.revokeAllForUser('user-id');

      expect(mockRepository.update).toHaveBeenCalledWith(
        {
          owner: { id: 'user-id' },
          isRevoked: false
        },
        {
          isRevoked: true
        }
      );
    });

    it('should use the transaction manager repository when provided', async () => {
      const transactionRepository = {
        update: jest.fn().mockResolvedValue(undefined)
      };
      const manager = {
        getRepository: jest.fn().mockReturnValue(transactionRepository)
      } as unknown as EntityManager;

      await service.revokeAllForUser('user-id', manager);

      expect(manager.getRepository).toHaveBeenCalledWith(Session);
      expect(transactionRepository.update).toHaveBeenCalledWith(
        {
          owner: { id: 'user-id' },
          isRevoked: false
        },
        {
          isRevoked: true
        }
      );
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });
});
