import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { UserErrorCode } from '@features/users/domain/errors/user-error-code.enum';
import { Permission } from '../../../domain/enums/permission.enum';
import { INVITATION_TTL_HOURS } from '../../invitation.constants';
import { AdminInvitationTokenService } from '../../services/admin-invitation-token.service';
import { InviteAdminUseCase } from '../invite-admin.use-case';

describe('InviteAdminUseCase', () => {
  let useCase: InviteAdminUseCase;

  const mockInvitationRepository = {
    create: jest.fn(),
    findPendingByEmail: jest.fn(),
    markRevoked: jest.fn()
  };

  const mockUserRepository = {
    findByEmailOrUsernameForAuth: jest.fn(),
    // Present only so the test below can prove it is never reached.
    insertUser: jest.fn()
  };

  const mockEmailService = {
    sendAdminInvitationEmail: jest.fn()
  };

  const mockClockService = { nowDate: jest.fn() };

  const mockDataSource = {
    transaction: jest.fn()
  };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const tokenService = new AdminInvitationTokenService();

  const NOW = new Date('2026-08-06T12:00:00Z');
  const ACTOR_ID = 'owner-1';

  const created = (overrides: Record<string, unknown> = {}) => ({
    id: 'invitation-1',
    email: 'invitee@test.com',
    permissions: [],
    expiresAt: new Date('2026-08-08T12:00:00Z'),
    invitedById: ACTOR_ID,
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockClockService.nowDate.mockReturnValue(NOW);
    mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue(null);
    mockInvitationRepository.findPendingByEmail.mockResolvedValue([]);
    mockInvitationRepository.create.mockResolvedValue(created());
    mockDataSource.transaction.mockImplementation(
      (cb: (manager: any) => Promise<unknown>) => cb({})
    );

    useCase = new InviteAdminUseCase(
      mockInvitationRepository as any,
      mockUserRepository as any,
      tokenService,
      mockClockService as unknown as ClockService,
      mockEmailService as any,
      mockDataSource as any,
      mockLogger as any
    );
  });

  describe('execute', () => {
    it('should create an invitation and email the token', async () => {
      await useCase.execute(ACTOR_ID, {
        email: 'invitee@test.com',
        permissions: [Permission.USER_READ]
      } as any);

      expect(mockInvitationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'invitee@test.com',
          permissions: [Permission.USER_READ],
          invitedById: ACTOR_ID
        }),
        expect.anything()
      );

      expect(mockEmailService.sendAdminInvitationEmail).toHaveBeenCalledWith(
        'invitee@test.com',
        expect.any(String),
        INVITATION_TTL_HOURS
      );
    });

    /**
     * The whole premise of the flow: issuing an invitation must not produce an
     * account. If this ever regresses, a revoked invitation would leave a
     * dormant privileged login behind.
     */
    it('should not create any account', async () => {
      await useCase.execute(ACTOR_ID, { email: 'invitee@test.com' } as any);

      expect(mockUserRepository.insertUser).not.toHaveBeenCalled();
      expect(mockInvitationRepository.create).toHaveBeenCalledTimes(1);
    });

    /** The server stores a digest; the plaintext exists only in the mailbox. */
    it('should store the digest of the emailed token, never the token', async () => {
      await useCase.execute(ACTOR_ID, { email: 'invitee@test.com' } as any);

      const stored = mockInvitationRepository.create.mock.calls[0][0];
      const emailed =
        mockEmailService.sendAdminInvitationEmail.mock.calls[0][1];

      expect(stored.tokenHash).toBe(tokenService.hash(emailed));
      expect(stored.tokenHash).not.toBe(emailed);
      expect(JSON.stringify(stored)).not.toContain(emailed);
    });

    it('should issue a distinct token per invitation', async () => {
      await useCase.execute(ACTOR_ID, { email: 'a@test.com' } as any);
      await useCase.execute(ACTOR_ID, { email: 'b@test.com' } as any);

      const [first, second] =
        mockEmailService.sendAdminInvitationEmail.mock.calls.map(
          (call: unknown[]) => call[1]
        );

      expect(first).not.toBe(second);
    });

    it('should expire the invitation the configured number of hours out', async () => {
      await useCase.execute(ACTOR_ID, { email: 'invitee@test.com' } as any);

      const { expiresAt } = mockInvitationRepository.create.mock.calls[0][0];

      expect(expiresAt.getTime() - NOW.getTime()).toBe(
        INVITATION_TTL_HOURS * 60 * 60 * 1000
      );
    });

    it('should normalise the address before storing it', async () => {
      await useCase.execute(ACTOR_ID, {
        email: '  Invitee@TEST.com  '
      } as any);

      expect(mockInvitationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'invitee@test.com' }),
        expect.anything()
      );
    });

    it('should default to no permissions when none are named', async () => {
      await useCase.execute(ACTOR_ID, { email: 'invitee@test.com' } as any);

      expect(mockInvitationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ permissions: [] }),
        expect.anything()
      );
    });

    /** Administrators are always new accounts, so a taken address is refused. */
    it('should refuse an address that already belongs to an account', async () => {
      mockUserRepository.findByEmailOrUsernameForAuth.mockResolvedValue({
        id: 'existing'
      });

      await expect(
        useCase.execute(ACTOR_ID, { email: 'taken@test.com' } as any)
      ).rejects.toThrow(
        expect.objectContaining({ code: UserErrorCode.EMAIL_ALREADY_EXISTS })
      );

      expect(mockInvitationRepository.create).not.toHaveBeenCalled();
      expect(mockEmailService.sendAdminInvitationEmail).not.toHaveBeenCalled();
    });

    /**
     * At most one invitation outstanding per address, so re-inviting a lapsed
     * address is a single call rather than revoke-then-invite.
     */
    it('should supersede an outstanding invitation for the same address', async () => {
      mockInvitationRepository.findPendingByEmail.mockResolvedValue([
        { id: 'stale-1' },
        { id: 'stale-2' }
      ]);

      await useCase.execute(ACTOR_ID, { email: 'invitee@test.com' } as any);

      expect(mockInvitationRepository.markRevoked).toHaveBeenCalledWith(
        'stale-1',
        NOW,
        expect.anything()
      );
      expect(mockInvitationRepository.markRevoked).toHaveBeenCalledWith(
        'stale-2',
        NOW,
        expect.anything()
      );
      expect(mockInvitationRepository.create).toHaveBeenCalled();
    });

    /**
     * Delivery failure must not roll the invitation back: the owner can revoke
     * and re-issue, whereas a rollback leaves them unable to tell whether the
     * address is now invited.
     */
    it('should keep the invitation when delivery fails', async () => {
      mockEmailService.sendAdminInvitationEmail.mockRejectedValue(
        new Error('SMTP down')
      );

      await expect(
        useCase.execute(ACTOR_ID, { email: 'invitee@test.com' } as any)
      ).resolves.toEqual(expect.objectContaining({ id: 'invitation-1' }));

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: LogEvent.EMAIL_SEND_FAILED }),
        expect.any(String)
      );
    });

    it('should record the invitation in the audit log', async () => {
      await useCase.execute(ACTOR_ID, {
        email: 'invitee@test.com',
        permissions: [Permission.USER_READ]
      } as any);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LogEvent.ADMIN_INVITED,
          actorId: ACTOR_ID,
          invitationId: 'invitation-1',
          email: 'invitee@test.com'
        }),
        expect.any(String)
      );
    });

    it('should not write the token into the audit log', async () => {
      await useCase.execute(ACTOR_ID, { email: 'invitee@test.com' } as any);

      const emailed =
        mockEmailService.sendAdminInvitationEmail.mock.calls[0][1];

      expect(JSON.stringify(mockLogger.info.mock.calls)).not.toContain(emailed);
    });
  });
});
