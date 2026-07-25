import { EntityManager } from 'typeorm';
import { RevokeAllUserSessionsService } from './revoke-all-user-sessions.service';

describe('RevokeAllUserSessionsService', () => {
  let service: RevokeAllUserSessionsService;

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const mockSessionRepository = {
    revokeAllSessionsForUser: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new RevokeAllUserSessionsService(
      mockSessionRepository as any,
      mockLogger as any
    );
  });

  describe('revokeAllSessionsForUser', () => {
    it('should revoke every active session belonging to the user', async () => {
      mockSessionRepository.revokeAllSessionsForUser.mockResolvedValue(
        undefined
      );

      await service.revokeAllSessionsForUser('user-id');

      expect(
        mockSessionRepository.revokeAllSessionsForUser
      ).toHaveBeenCalledWith('user-id', undefined);
    });

    it('should pass the transaction manager when provided', async () => {
      const manager = {} as EntityManager;

      mockSessionRepository.revokeAllSessionsForUser.mockResolvedValue(
        undefined
      );

      await service.revokeAllSessionsForUser('user-id', manager);

      expect(
        mockSessionRepository.revokeAllSessionsForUser
      ).toHaveBeenCalledWith('user-id', manager);
    });
  });
});
