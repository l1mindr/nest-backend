import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { RevokeAdminInvitationUseCase } from '../revoke-admin-invitation.use-case';

describe('RevokeAdminInvitationUseCase', () => {
  let useCase: RevokeAdminInvitationUseCase;

  const mockInvitationRepository = {
    findById: jest.fn(),
    markRevoked: jest.fn()
  };

  const mockClockService = { nowDate: jest.fn() };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const NOW = new Date('2026-08-06T12:00:00Z');
  const ACTOR_ID = 'owner-1';

  const invitation = (overrides: Record<string, unknown> = {}) => ({
    id: 'invitation-1',
    email: 'invitee@test.com',
    expiresAt: new Date('2026-08-08T12:00:00Z'),
    acceptedAt: null,
    revokedAt: null,
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockClockService.nowDate.mockReturnValue(NOW);
    mockInvitationRepository.findById.mockResolvedValue(invitation());

    useCase = new RevokeAdminInvitationUseCase(
      mockInvitationRepository as any,
      mockClockService as unknown as ClockService,
      mockLogger as any
    );
  });

  describe('execute', () => {
    it('should mark a pending invitation revoked', async () => {
      await useCase.execute(ACTOR_ID, 'invitation-1');

      expect(mockInvitationRepository.markRevoked).toHaveBeenCalledWith(
        'invitation-1',
        NOW
      );
    });

    it('should refuse an unknown invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(ACTOR_ID, 'missing')).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.INVITATION_NOT_FOUND,
          statusCode: 404
        })
      );

      expect(mockInvitationRepository.markRevoked).not.toHaveBeenCalled();
    });

    /**
     * Revoking an accepted invitation would not unmake the account it created,
     * so it is refused rather than silently doing nothing.
     */
    it('should refuse an already accepted invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue(
        invitation({ acceptedAt: NOW })
      );

      await expect(useCase.execute(ACTOR_ID, 'invitation-1')).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.INVITATION_NOT_PENDING
        })
      );

      expect(mockInvitationRepository.markRevoked).not.toHaveBeenCalled();
    });

    it('should refuse an already revoked invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue(
        invitation({ revokedAt: NOW })
      );

      await expect(useCase.execute(ACTOR_ID, 'invitation-1')).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.INVITATION_NOT_PENDING
        })
      );

      expect(mockInvitationRepository.markRevoked).not.toHaveBeenCalled();
    });

    /** This is how the owner clears the way to re-invite the same address. */
    it('should allow revoking an expired invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue(
        invitation({ expiresAt: new Date('2026-08-01T12:00:00Z') })
      );

      await useCase.execute(ACTOR_ID, 'invitation-1');

      expect(mockInvitationRepository.markRevoked).toHaveBeenCalled();
    });

    /** The row survives so the audit trail keeps the fact it was issued. */
    it('should mark rather than delete the invitation', async () => {
      await useCase.execute(ACTOR_ID, 'invitation-1');

      expect(mockInvitationRepository).not.toHaveProperty('delete');
      expect(mockInvitationRepository.markRevoked).toHaveBeenCalledTimes(1);
    });

    it('should record the revocation in the audit log', async () => {
      await useCase.execute(ACTOR_ID, 'invitation-1');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LogEvent.ADMIN_INVITATION_REVOKED,
          actorId: ACTOR_ID,
          invitationId: 'invitation-1',
          email: 'invitee@test.com'
        }),
        expect.any(String)
      );
    });
  });
});
