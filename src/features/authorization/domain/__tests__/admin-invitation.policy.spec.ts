import { AuthorizationErrorCode } from '../errors/authorization-error-code.enum';
import {
  AdminInvitationPolicy,
  AdminInvitationStatus,
  InvitationLifecycle
} from '../admin-invitation.policy';

describe('AdminInvitationPolicy', () => {
  const NOW = new Date('2026-08-06T12:00:00Z');

  const invitation = (
    overrides: Partial<InvitationLifecycle> = {}
  ): InvitationLifecycle => ({
    expiresAt: new Date('2026-08-08T12:00:00Z'),
    acceptedAt: null,
    revokedAt: null,
    ...overrides
  });

  describe('statusOf', () => {
    it('should report an unused, unexpired invitation as pending', () => {
      expect(AdminInvitationPolicy.statusOf(invitation(), NOW)).toBe(
        AdminInvitationStatus.PENDING
      );
    });

    it('should report an invitation past its expiry as expired', () => {
      const lapsed = invitation({
        expiresAt: new Date('2026-08-06T11:59:59Z')
      });

      expect(AdminInvitationPolicy.statusOf(lapsed, NOW)).toBe(
        AdminInvitationStatus.EXPIRED
      );
    });

    /** Expiry is inclusive: the instant it expires, it is expired. */
    it('should treat the expiry instant itself as expired', () => {
      const boundary = invitation({ expiresAt: new Date(NOW) });

      expect(AdminInvitationPolicy.statusOf(boundary, NOW)).toBe(
        AdminInvitationStatus.EXPIRED
      );
    });

    it('should report a revoked invitation as revoked', () => {
      const revoked = invitation({ revokedAt: NOW });

      expect(AdminInvitationPolicy.statusOf(revoked, NOW)).toBe(
        AdminInvitationStatus.REVOKED
      );
    });

    it('should report an accepted invitation as accepted', () => {
      const accepted = invitation({ acceptedAt: NOW });

      expect(AdminInvitationPolicy.statusOf(accepted, NOW)).toBe(
        AdminInvitationStatus.ACCEPTED
      );
    });

    /**
     * Precision over recency: "already used" is the more useful answer than
     * "expired" for an invitation that was accepted and then sat around.
     */
    it('should prefer ACCEPTED over EXPIRED for a used invitation that has since lapsed', () => {
      const used = invitation({
        acceptedAt: new Date('2026-08-05T12:00:00Z'),
        expiresAt: new Date('2026-08-06T11:00:00Z')
      });

      expect(AdminInvitationPolicy.statusOf(used, NOW)).toBe(
        AdminInvitationStatus.ACCEPTED
      );
    });

    it('should prefer ACCEPTED over REVOKED when both are somehow set', () => {
      const both = invitation({ acceptedAt: NOW, revokedAt: NOW });

      expect(AdminInvitationPolicy.statusOf(both, NOW)).toBe(
        AdminInvitationStatus.ACCEPTED
      );
    });
  });

  describe('isPending', () => {
    it.each([
      ['unused', invitation(), true],
      ['revoked', invitation({ revokedAt: NOW }), false],
      ['accepted', invitation({ acceptedAt: NOW }), false],
      ['expired', invitation({ expiresAt: new Date(0) }), false]
    ])('should report %s as pending=%s', (_label, subject, expected) => {
      expect(AdminInvitationPolicy.isPending(subject, NOW)).toBe(expected);
    });
  });

  describe('assertAcceptable', () => {
    it('should permit a pending invitation', () => {
      expect(() =>
        AdminInvitationPolicy.assertAcceptable(invitation(), NOW)
      ).not.toThrow();
    });

    /** `410` rather than `409`, so a client can offer "ask for a new one". */
    it('should raise INVITATION_EXPIRED for a lapsed invitation', () => {
      expect(() =>
        AdminInvitationPolicy.assertAcceptable(
          invitation({ expiresAt: new Date(0) }),
          NOW
        )
      ).toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.INVITATION_EXPIRED,
          statusCode: 410
        })
      );
    });

    it('should raise INVITATION_NOT_PENDING for a revoked invitation', () => {
      expect(() =>
        AdminInvitationPolicy.assertAcceptable(
          invitation({ revokedAt: NOW }),
          NOW
        )
      ).toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.INVITATION_NOT_PENDING,
          statusCode: 409
        })
      );
    });

    /** One-time use: the second acceptance of the same token is refused. */
    it('should raise INVITATION_NOT_PENDING for an already accepted invitation', () => {
      expect(() =>
        AdminInvitationPolicy.assertAcceptable(
          invitation({ acceptedAt: NOW }),
          NOW
        )
      ).toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.INVITATION_NOT_PENDING
        })
      );
    });
  });

  describe('assertRevocable', () => {
    it('should permit revoking a pending invitation', () => {
      expect(() =>
        AdminInvitationPolicy.assertRevocable(invitation())
      ).not.toThrow();
    });

    /**
     * Revoking an expired invitation is how the owner clears the way to
     * re-invite the same address, so it is deliberately allowed.
     */
    it('should permit revoking an expired invitation', () => {
      expect(() =>
        AdminInvitationPolicy.assertRevocable(
          invitation({ expiresAt: new Date(0) })
        )
      ).not.toThrow();
    });

    it('should refuse revoking an accepted invitation', () => {
      expect(() =>
        AdminInvitationPolicy.assertRevocable(invitation({ acceptedAt: NOW }))
      ).toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.INVITATION_NOT_PENDING
        })
      );
    });

    it('should refuse revoking an already revoked invitation', () => {
      expect(() =>
        AdminInvitationPolicy.assertRevocable(invitation({ revokedAt: NOW }))
      ).toThrow(
        expect.objectContaining({
          code: AuthorizationErrorCode.INVITATION_NOT_PENDING
        })
      );
    });
  });
});
