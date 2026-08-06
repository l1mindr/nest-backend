import { AuthorizationErrors } from './errors/authorization-errors';

export enum AdminInvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED'
}

/** The subset of an invitation the lifecycle rules actually depend on. */
export interface InvitationLifecycle {
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
}

/**
 * When an invitation may still be used.
 *
 * One place decides this so that "one-time use", "expires" and "revocable" are
 * a single rule rather than three checks each endpoint has to remember. The
 * order matters: an already-used token reports as used even after it would have
 * expired, because that is the more precise answer.
 */
export class AdminInvitationPolicy {
  static statusOf(
    invitation: InvitationLifecycle,
    now: Date
  ): AdminInvitationStatus {
    if (invitation.acceptedAt) return AdminInvitationStatus.ACCEPTED;
    if (invitation.revokedAt) return AdminInvitationStatus.REVOKED;

    if (invitation.expiresAt.getTime() <= now.getTime()) {
      return AdminInvitationStatus.EXPIRED;
    }

    return AdminInvitationStatus.PENDING;
  }

  static isPending(invitation: InvitationLifecycle, now: Date): boolean {
    return this.statusOf(invitation, now) === AdminInvitationStatus.PENDING;
  }

  /**
   * Guards acceptance. Reaching here means the caller presented a token that
   * matched, so telling them precisely why it will not work discloses nothing
   * they are not entitled to know — a caller without the token gets a flat
   * "not found" long before this.
   */
  static assertAcceptable(invitation: InvitationLifecycle, now: Date): void {
    const status = this.statusOf(invitation, now);

    if (status === AdminInvitationStatus.PENDING) return;

    if (status === AdminInvitationStatus.EXPIRED) {
      throw AuthorizationErrors.invitationExpired();
    }

    throw AuthorizationErrors.invitationNotPending();
  }

  /**
   * Revoking is only meaningful while the invitation has not already been
   * settled. An expired one may still be revoked: that is how the owner clears
   * the way to re-invite the same address.
   */
  static assertRevocable(invitation: InvitationLifecycle): void {
    if (invitation.acceptedAt || invitation.revokedAt) {
      throw AuthorizationErrors.invitationNotPending();
    }
  }
}
