import { DataSource, EntityManager } from 'typeorm';
import { Session } from '../entities/session.entity';
import { TerminateOtherSessionsService } from './terminate-other-sessions.service';

describe('TerminateOtherSessionsService', () => {
  let service: TerminateOtherSessionsService;

  const mockRepository = {
    update: jest.fn()
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockRepository)
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new TerminateOtherSessionsService(
      mockDataSource as unknown as DataSource
    );
  });

  describe('terminateOthers', () => {
    it('should revoke all other sessions', async () => {
      mockRepository.update.mockResolvedValue(undefined);

      await service.terminateOthers('user-id', 'current-session');

      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should use the transaction manager repository when provided', async () => {
      const transactionRepository = {
        update: jest.fn().mockResolvedValue(undefined)
      };
      const manager = {
        getRepository: jest.fn().mockReturnValue(transactionRepository)
      } as unknown as EntityManager;

      await service.terminateOthers('user-id', 'current-session', manager);

      expect(manager.getRepository).toHaveBeenCalledWith(Session);
      expect(transactionRepository.update).toHaveBeenCalled();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });
});
