import { EntityManager } from 'typeorm';
import { SessionRevocationUseCase } from '../../use-cases/session-revocation.use-case';

describe('SessionRevocationUseCase', () => {
  let service: SessionRevocationUseCase;

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

  const mockRealtimeEventPublisher = {
    publishToUser: jest.fn(),
    disconnectSession: jest.fn(),
    disconnectUser: jest.fn(),
    disconnectUserExcept: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new SessionRevocationUseCase(
      mockSessionRepository as any,
      mockLogger as any,
      { record: jest.fn() } as any,
      mockRealtimeEventPublisher as any
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

    it('should disconnect the revoked session socket', async () => {
      mockSessionRepository.revokeSession.mockResolvedValue(undefined);

      await service.revoke('user-id', 'session-id');

      expect(mockRealtimeEventPublisher.disconnectSession).toHaveBeenCalledWith(
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

    it('should disconnect every socket belonging to the user', async () => {
      mockSessionRepository.revokeAllSessionsForUser.mockResolvedValue(
        undefined
      );

      await service.revokeAll('user-id');

      expect(mockRealtimeEventPublisher.disconnectUser).toHaveBeenCalledWith(
        'user-id'
      );
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

    it('should disconnect every socket except the current session', async () => {
      mockSessionRepository.revokeSessionsExceptCurrent.mockResolvedValue(
        undefined
      );

      await service.terminateOthers('user-id', 'current-session');

      expect(
        mockRealtimeEventPublisher.disconnectUserExcept
      ).toHaveBeenCalledWith('user-id', 'current-session');
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
