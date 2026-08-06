import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { AuthorizationErrorCode } from '../../../domain/errors/authorization-error-code.enum';
import { Permission } from '../../../domain/enums/permission.enum';
import { AdminInvitationTokenService } from '../../services/admin-invitation-token.service';
import { AcceptAdminInvitationUseCase } from '../accept-admin-invitation.use-case';

describe('AcceptAdminInvitationUseCase', () => {
  let useCase: AcceptAdminInvitationUseCase;

  const mockInvitationRepository = {
    findByTokenHash: jest.fn(),
    markAccepted: jest.fn()
  };

  const mockAdminPermissionRepository = { grant: jest.fn() };
  const mockUserRepository = { insertUser: jest.fn() };
  const mockHashingProvider = { hash: jest.fn() };
  const mockClockService = { nowDate: jest.fn() };
  const mockDataSource = { transaction: jest.fn() };

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const tokenService = new AdminInvitationTokenService();

  const NOW = new Date('2026-08-06T12:00:00Z');
  const TOKEN = 'a'.repeat(43);
  const CREATED_ID = 'new-admin-1';

  const invitation = (overrides: Record<string, unknown> = {}) => ({
    id: 'invitation-1',
    email: 'invitee@test.com',
    permissions: [Permission.USER_READ],
    expiresAt: new Date('2026-08-08T12:00:00Z'),
    acceptedAt: null,
    revokedAt: null,
    invitedById: 'owner-1',
    ...overrides
  });

  const dto = (overrides: Record<string, unknown> = {}) =>
    ({
      token: TOKEN,
      username: 'new_admin',
      password: 'Str0ng!Pass',
      ...overrides
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClockService.nowDate.mockReturnValue(NOW);
    mockHashingProvider.hash.mockResolvedValue('hashed-password');
    mockUserRepository.insertUser.mockResolvedValue({ id: CREATED_ID });
    mockInvitationRepository.findByTokenHash.mockResolvedValue(invitation());
    mockDataSource.transaction.mockImplementation(
      (cb: (manager: any) => Promise<unknown>) => cb({})
    );

    useCase = new AcceptAdminInvitationUseCase(
      mockInvitationRepository as any,
      mockAdminPermissionRepository as any,
      mockUserRepository as any,
      tokenService,
      mockHashingProvider as any,
      mockClockService as unknown as ClockService,
      mockDataSource as any,
      mockLogger as any
    );
  });

  describe('execute', () => {
    it('should look the invitation up by the digest of the presented token', async () => {
      await useCase.execute(dto());

      expect(mockInvitationRepository.findByTokenHash).toHaveBeenCalledWith(
        tokenService.hash(TOKEN)
      );
    });

    /** This is the only place in the system that writes the `ADMIN` role. */
    it('should create an active administrator with the invited permissions', async () => {
      await useCase.execute(dto({ name: 'New Admin' }));

      expect(mockUserRepository.insertUser).toHaveBeenCalledWith(
        {
          email: 'invitee@test.com',
          username: 'new_admin',
          password: 'hashed-password',
          name: 'New Admin',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVATE
        },
        expect.anything()
      );

      expect(mockAdminPermissionRepository.grant).toHaveBeenCalledWith(
        CREATED_ID,
        [Permission.USER_READ],
        'owner-1',
        expect.anything()
      );
    });

    /**
     * The address comes from the invitation, never from the request: the token
     * is what proves control of that mailbox. Accepting a client-supplied email
     * would let a stolen token be redirected to an attacker's address.
     */
    it('should take the email from the invitation, not the request', async () => {
      await useCase.execute(dto({ email: 'attacker@evil.com' }));

      expect(mockUserRepository.insertUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'invitee@test.com' }),
        expect.anything()
      );
    });

    it('should store a hash of the chosen password rather than the password', async () => {
      await useCase.execute(dto());

      expect(mockHashingProvider.hash).toHaveBeenCalledWith('Str0ng!Pass');
      expect(mockUserRepository.insertUser).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'hashed-password' }),
        expect.anything()
      );
    });

    it('should default the display name to null when none is given', async () => {
      await useCase.execute(dto());

      expect(mockUserRepository.insertUser).toHaveBeenCalledWith(
        expect.objectContaining({ name: null }),
        expect.anything()
      );
    });

    /** One-time use: the invitation is burned as part of the same transaction. */
    it('should burn the invitation', async () => {
      await useCase.execute(dto());

      expect(mockInvitationRepository.markAccepted).toHaveBeenCalledWith(
        'invitation-1',
        NOW,
        CREATED_ID,
        expect.anything()
      );
    });

    it('should do all three writes inside one transaction', async () => {
      await useCase.execute(dto());

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
    });

    /**
     * If any step fails none of it happened and the token is still usable —
     * otherwise a partial failure could burn an invitation without producing
     * the account it was meant to create.
     */
    it('should not burn the invitation when the account cannot be created', async () => {
      mockDataSource.transaction.mockRejectedValue(new Error('constraint'));

      await expect(useCase.execute(dto())).rejects.toThrow();

      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.objectContaining({
          event: LogEvent.ADMIN_INVITATION_ACCEPTED
        }),
        expect.any(String)
      );
    });

    it('should refuse an unknown token', async () => {
      mockInvitationRepository.findByTokenHash.mockResolvedValue(null);

      await expect(useCase.execute(dto())).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.INVITATION_NOT_FOUND,
          statusCode: 404
        })
      );

      expect(mockUserRepository.insertUser).not.toHaveBeenCalled();
    });

    it('should refuse an expired invitation', async () => {
      mockInvitationRepository.findByTokenHash.mockResolvedValue(
        invitation({ expiresAt: new Date('2026-08-06T11:00:00Z') })
      );

      await expect(useCase.execute(dto())).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.INVITATION_EXPIRED
        })
      );

      expect(mockUserRepository.insertUser).not.toHaveBeenCalled();
    });

    it('should refuse a revoked invitation', async () => {
      mockInvitationRepository.findByTokenHash.mockResolvedValue(
        invitation({ revokedAt: NOW })
      );

      await expect(useCase.execute(dto())).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.INVITATION_NOT_PENDING
        })
      );

      expect(mockUserRepository.insertUser).not.toHaveBeenCalled();
    });

    it('should refuse a token that has already been used', async () => {
      mockInvitationRepository.findByTokenHash.mockResolvedValue(
        invitation({ acceptedAt: new Date('2026-08-05T12:00:00Z') })
      );

      await expect(useCase.execute(dto())).rejects.toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.INVITATION_NOT_PENDING
        })
      );

      expect(mockUserRepository.insertUser).not.toHaveBeenCalled();
    });

    it('should log a rejection without disclosing the token', async () => {
      mockInvitationRepository.findByTokenHash.mockResolvedValue(null);

      await expect(useCase.execute(dto())).rejects.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LogEvent.ADMIN_INVITATION_REJECTED,
          reason: 'UNKNOWN_TOKEN'
        }),
        expect.any(String)
      );
      expect(JSON.stringify(mockLogger.warn.mock.calls)).not.toContain(TOKEN);
    });

    it('should record the acceptance in the audit log', async () => {
      await useCase.execute(dto());

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LogEvent.ADMIN_INVITATION_ACCEPTED,
          invitationId: 'invitation-1',
          userId: CREATED_ID,
          invitedById: 'owner-1'
        }),
        expect.any(String)
      );
    });

    /**
     * The single place a role is written still asks whether it may be assigned,
     * so `OWNER` can never arrive here however the use case is called.
     */
    it('should never create an owner even if the invitation names that role', async () => {
      await useCase.execute(dto());

      expect(mockUserRepository.insertUser).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.ADMIN }),
        expect.anything()
      );
    });
  });
});
