import { ClockService } from '@infrastructure/clock/clock.service';
import { Injectable } from '@nestjs/common';
import { AdminInvitationResponseDto } from '../../presentation/dto/response/admin-invitation.response.dto';
import { AdminInvitation } from '../../domain/entities/admin-invitation.entity';
import { AdminInvitationPolicy } from '../../domain/admin-invitation.policy';

/**
 * Shapes an invitation for the owner.
 *
 * `status` is derived here rather than stored, because expiry is a function of
 * the clock: a row that was `PENDING` when it was written becomes `EXPIRED`
 * without anything updating it. Asking the policy means the state reported to
 * the owner is the same one acceptance will apply, rather than a second opinion
 * that could drift from it.
 *
 * `tokenHash` is absent from the entity by default (`select: false`) and is not
 * mapped here either, so there is no path by which it reaches a response.
 */
@Injectable()
export class AdminInvitationMapper {
  constructor(private readonly clockService: ClockService) {}

  toResponse(invitation: AdminInvitation): AdminInvitationResponseDto {
    return this.map(invitation, this.clockService.nowDate());
  }

  /** Resolves the clock once for the whole page rather than per row. */
  toResponseList(invitations: AdminInvitation[]): AdminInvitationResponseDto[] {
    const now = this.clockService.nowDate();

    return invitations.map((invitation) => this.map(invitation, now));
  }

  private map(
    invitation: AdminInvitation,
    now: Date
  ): AdminInvitationResponseDto {
    return {
      id: invitation.id,
      email: invitation.email,
      status: AdminInvitationPolicy.statusOf(invitation, now),
      permissions: [...invitation.permissions],
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      revokedAt: invitation.revokedAt,
      invitedById: invitation.invitedById,
      createdAt: invitation.createdAt
    };
  }
}
