import { DataSource } from 'typeorm';
import { RevokeSessionService } from './revoke-session.service';

describe('RevokeSessionService', () => {
  let service: RevokeSessionService;

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

    service = new RevokeSessionService(
      mockDataSource as unknown as DataSource,
      mockLogger as any
    );
  });

  describe('revoke', () => {
    it('should revoke session', async () => {
      mockRepository.update.mockResolvedValue(undefined);

      await service.revoke('user-id', 'session-id');

      expect(mockRepository.update).toHaveBeenCalledWith(
        {
          owner: { id: 'user-id' },
          id: 'session-id'
        },
        {
          isRevoked: true
        }
      );
    });
  });
});
