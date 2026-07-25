import { EntityManager } from 'typeorm';
import { TerminateOtherSessionsService } from './terminate-other-sessions.service';

describe('TerminateOtherSessionsService', () => {
  let service: TerminateOtherSessionsService;

  const mockSessionRepository = {
    revokeSessionsExceptCurrent: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new TerminateOtherSessionsService(mockSessionRepository as any);
  });

  describe('terminateOtherSessions', () => {
    it('should revoke all other sessions', async () => {
      mockSessionRepository.revokeSessionsExceptCurrent.mockResolvedValue(
        undefined
      );

      await service.terminateOtherSessions('user-id', 'current-session');

      expect(
        mockSessionRepository.revokeSessionsExceptCurrent
      ).toHaveBeenCalledWith('user-id', 'current-session', undefined);
    });

    it('should pass the transaction manager when provided', async () => {
      const manager = {} as EntityManager;

      mockSessionRepository.revokeSessionsExceptCurrent.mockResolvedValue(
        undefined
      );

      await service.terminateOtherSessions(
        'user-id',
        'current-session',
        manager
      );

      expect(
        mockSessionRepository.revokeSessionsExceptCurrent
      ).toHaveBeenCalledWith('user-id', 'current-session', manager);
    });
  });
});
