import { ClockService } from '@infrastructure/clock/clock.service';
import { emailDedupeKey } from '@infrastructure/email/email-dedupe.key';
import { EmailMessageType } from '@infrastructure/email/email.message';
import { EmailPublisher } from '@infrastructure/email/email.publisher';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { UserErrors } from '@features/users/domain/errors/user-errors';
import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/application/interfaces/users.interface';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { AdminInvitation } from '../../domain/entities/admin-invitation.entity';
import { InviteAdminRequestDto } from '../../presentation/dto/request/invite-admin.request.dto';
import {
  ADMIN_INVITATION_REPOSITORY,
  IAdminInvitationRepository,
  IInviteAdminUseCase
} from '../interfaces/authorization.interface';
import { AdminInvitationTokenService } from '../services/admin-invitation-token.service';
import {
  INVITATION_TTL_HOURS,
  INVITATION_TTL_MS
} from '../invitation.constants';

/**
 * Issues an invitation to become an administrator.
 *
 * No account is created here. Until the invitation is accepted the only trace
 * is this row and an email, so a revoked or expired invitation leaves nothing
 * behind that could be signed into — which is the point of replacing promotion
 * with an invitation in the first place.
 */
@Injectable()
export class InviteAdminUseCase implements IInviteAdminUseCase {
  constructor(
    @Inject(ADMIN_INVITATION_REPOSITORY)
    private readonly invitationRepository: IAdminInvitationRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly tokenService: AdminInvitationTokenService,
    private readonly clockService: ClockService,
    private readonly emailPublisher: EmailPublisher,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(InviteAdminUseCase.name);
  }

  async execute(
    actorId: string,
    dto: InviteAdminRequestDto
  ): Promise<AdminInvitation> {
    const email = dto.email.trim().toLowerCase();

    // Administrators are always new accounts. Refusing a taken address keeps
    // the two populations apart and means acceptance can never collide with an
    // existing login.
    const existing =
      await this.userRepository.findByEmailOrUsernameForAuth(email);

    if (existing) throw UserErrors.emailAlreadyExists();

    const token = this.tokenService.generate();
    const now = this.clockService.nowDate();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);

    const { invitation, superseded } = await this.dataSource.transaction(
      async (manager) => {
        // At most one invitation may be outstanding per address, enforced by a
        // partial unique index. Superseding the old one keeps re-inviting a
        // lapsed address a single call rather than revoke-then-invite.
        const outstanding =
          await this.invitationRepository.findPendingByEmail(email);

        for (const stale of outstanding) {
          await this.invitationRepository.markRevoked(stale.id, now, manager);
        }

        const created = await this.invitationRepository.create(
          {
            email,
            tokenHash: this.tokenService.hash(token),
            permissions: dto.permissions ?? [],
            expiresAt,
            invitedById: actorId
          },
          manager
        );

        return { invitation: created, superseded: outstanding.length };
      }
    );

    this.logger.info(
      {
        event: LogEvent.ADMIN_INVITED,
        actorId,
        invitationId: invitation.id,
        email,
        permissions: invitation.permissions,
        expiresAt,
        superseded
      },
      'Administrator invitation issued'
    );

    // Delivery failure must not roll the invitation back: the owner can revoke
    // and re-issue, whereas a rollback would leave them unable to tell whether
    // the address is now invited or not. Publishing cannot throw, so the
    // invitation stands either way.
    //
    // Keyed on the invitation row, so re-inviting an address delivers the token
    // for the new invitation and never a second copy of the same one.
    await this.emailPublisher.publish(
      {
        type: EmailMessageType.ADMIN_INVITATION,
        to: email,
        data: {
          token,
          expiresInHours: INVITATION_TTL_HOURS
        }
      },
      {
        dedupeKey: emailDedupeKey(
          EmailMessageType.ADMIN_INVITATION,
          invitation.id
        )
      }
    );

    return invitation;
  }
}
