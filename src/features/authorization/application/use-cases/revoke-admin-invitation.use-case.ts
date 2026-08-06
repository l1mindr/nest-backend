import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AdminInvitationPolicy } from '../../domain/admin-invitation.policy';
import { AuthorizationErrors } from '../../domain/errors/authorization-errors';
import {
  ADMIN_INVITATION_REPOSITORY,
  IAdminInvitationRepository,
  IRevokeAdminInvitationUseCase
} from '../interfaces/authorization.interface';

/**
 * Withdraws an invitation before it is used. The row is kept, marked revoked,
 * so the audit trail still shows that an invitation was issued and thought
 * better of — deleting it would erase the fact that it existed.
 */
@Injectable()
export class RevokeAdminInvitationUseCase implements IRevokeAdminInvitationUseCase {
  constructor(
    @Inject(ADMIN_INVITATION_REPOSITORY)
    private readonly invitationRepository: IAdminInvitationRepository,
    private readonly clockService: ClockService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(RevokeAdminInvitationUseCase.name);
  }

  async execute(actorId: string, invitationId: string): Promise<void> {
    const invitation = await this.invitationRepository.findById(invitationId);

    if (!invitation) throw AuthorizationErrors.invitationNotFound();

    AdminInvitationPolicy.assertRevocable(invitation);

    const now = this.clockService.nowDate();

    await this.invitationRepository.markRevoked(invitation.id, now);

    this.logger.info(
      {
        event: LogEvent.ADMIN_INVITATION_REVOKED,
        actorId,
        invitationId: invitation.id,
        email: invitation.email
      },
      'Administrator invitation revoked'
    );
  }
}
