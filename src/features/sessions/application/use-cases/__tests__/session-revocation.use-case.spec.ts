import { ActivityAction } from '@features/activity/domain/enums/activity-action.enum';
import { ActivityCategory } from '@features/activity/domain/enums/activity-category.enum';
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
    revokeSessionsExceptCurrent: jest.fn(),
    findActiveSession: jest.fn()
  };

  const mockRealtimeEventPublisher = {
    publishToUser: jest.fn(),
    disconnectSession: jest.fn(),
    disconnectUser: jest.fn(),
    disconnectUserExcept: jest.fn()
  };

  const mockActivityRecorder = { record: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();

    service = new SessionRevocationUseCase(
      mockSessionRepository as any,
      mockLogger as any,
      { record: jest.fn() } as any,
      mockRealtimeEventPublisher as any,
      mockActivityRecorder as any
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

  /**
   * Ending your own session and signing another device out are different
   * facts to a user, so they are different activities — even though both go
   * through the same revocation underneath.
   */
  describe('user activity', () => {
    beforeEach(() => {
      mockSessionRepository.revokeSession.mockResolvedValue(undefined);
    });

    it('records a logout when the caller ends their own session', async () => {
      await service.revoke('user-1', 'session-1');

      expect(mockActivityRecorder.record).toHaveBeenCalledWith({
        userId: 'user-1',
        category: ActivityCategory.SECURITY,
        action: ActivityAction.LOGOUT,
        entityType: 'SESSION',
        entityId: 'session-1'
      });
    });

    it('records a revocation when the caller signs another device out', async () => {
      mockSessionRepository.findActiveSession.mockResolvedValue({
        id: 'session-2'
      });

      await service.revokeOwned('user-1', 'session-1', 'session-2');

      expect(mockActivityRecorder.record).toHaveBeenCalledWith({
        userId: 'user-1',
        category: ActivityCategory.SECURITY,
        action: ActivityAction.SESSION_REVOKED,
        entityType: 'SESSION',
        entityId: 'session-2'
      });
    });

    // One row for the action the user took, not one per session ended.
    it('records a single revocation for "sign out everywhere else"', async () => {
      mockSessionRepository.revokeSessionsExceptCurrent.mockResolvedValue(
        undefined
      );

      await service.terminateOthers('user-1', 'session-1');

      expect(mockActivityRecorder.record).toHaveBeenCalledTimes(1);
      expect(mockActivityRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ActivityAction.SESSION_REVOKED,
          metadata: { scope: 'OTHERS' }
        })
      );
    });

    it('records nothing when the target session does not exist', async () => {
      mockSessionRepository.findActiveSession.mockResolvedValue(null);

      await expect(
        service.revokeOwned('user-1', 'session-1', 'missing')
      ).rejects.toBeDefined();

      expect(mockActivityRecorder.record).not.toHaveBeenCalled();
    });

    // Revoking the session you are using is a logout, and is refused here.
    it('records nothing when asked to revoke the current session', async () => {
      await expect(
        service.revokeOwned('user-1', 'session-1', 'session-1')
      ).rejects.toBeDefined();

      expect(mockActivityRecorder.record).not.toHaveBeenCalled();
    });
  });
});
