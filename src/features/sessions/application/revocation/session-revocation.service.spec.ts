import { EntityManager } from 'typeorm';
import { SessionRevocationService } from './session-revocation.service';

describe('SessionRevocationService', () => {
  let service: SessionRevocationService;

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const mockSessionRepository = {
    revokeSession: jest.fn(),
    revokeAllSessionsForUser: jest.fn(),
    revokeSessionsExceptCurrent: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new SessionRevocationService(
      mockSessionRepository as any,
      mockLogger as any
    );
  });

  describe('revoke', () => {
    it('should revoke session', async () => {
      mockSessionRepository.revokeSession.mockResolvedValue(undefined);

      await service.revoke('user-id', 'session-id');

      expect(mockSessionRepository.revokeSession).toHaveBeenCalledWith(
        'user-id',
        'session-id'
      );
    });
  });

  describe('revokeAll', () => {
    it('should revoke every active session belonging to the user', async () => {
      mockSessionRepository.revokeAllSessionsForUser.mockResolvedValue(
        undefined
      );

      await service.revokeAll('user-id');

      expect(
        mockSessionRepository.revokeAllSessionsForUser
      ).toHaveBeenCalledWith('user-id', undefined);
    });

    it('should pass the transaction manager when provided', async () => {
      const manager = {} as EntityManager;

      mockSessionRepository.revokeAllSessionsForUser.mockResolvedValue(
        undefined
      );

      await service.revokeAll('user-id', manager);

      expect(
        mockSessionRepository.revokeAllSessionsForUser
      ).toHaveBeenCalledWith('user-id', manager);
    });
  });

  describe('terminateOthers', () => {
    it('should revoke all other sessions', async () => {
      mockSessionRepository.revokeSessionsExceptCurrent.mockResolvedValue(
        undefined
      );

      await service.terminateOthers('user-id', 'current-session');

      expect(
        mockSessionRepository.revokeSessionsExceptCurrent
      ).toHaveBeenCalledWith('user-id', 'current-session', undefined);
    });

    it('should pass the transaction manager when provided', async () => {
      const manager = {} as EntityManager;

      mockSessionRepository.revokeSessionsExceptCurrent.mockResolvedValue(
        undefined
      );

      await service.terminateOthers('user-id', 'current-session', manager);

      expect(
        mockSessionRepository.revokeSessionsExceptCurrent
      ).toHaveBeenCalledWith('user-id', 'current-session', manager);
    });
  });
});
