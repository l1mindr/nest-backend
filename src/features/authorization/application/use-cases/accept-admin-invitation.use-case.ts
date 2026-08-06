import { ClockService } from '@infrastructure/clock/clock.service';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { HashingProvider } from '@features/auth/infrastructure/providers/hashing.provider';
import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { throwOnUniqueConstraint } from '@features/users/infrastructure/providers/unique-constraint.handler';
import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/application/interfaces/users.interface';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { AdminInvitationPolicy } from '../../domain/admin-invitation.policy';
import { AuthorizationErrors } from '../../domain/errors/authorization-errors';
import { OwnerProtectionPolicy } from '../../domain/owner-protection.policy';
import { AcceptAdminInvitationRequestDto } from '../../presentation/dto/request/accept-admin-invitation.request.dto';
import {
  ADMIN_INVITATION_REPOSITORY,
  ADMIN_PERMISSION_REPOSITORY,
  IAcceptAdminInvitationUseCase,
  IAdminInvitationRepository,
  IAdminPermissionRepository
} from '../interfaces/authorization.interface';
import { AdminInvitationTokenService } from '../services/admin-invitation-token.service';

/**
 * Turns an invitation into an administrator account.
 *
 * This is the only place in the system that writes the `ADMIN` role, and it is
 * unauthenticated — the token is the entire proof. Everything therefore happens
 * in one transaction: create the account, grant the invited permissions, and
 * burn the invitation. If any step fails, none of it happened, and the token is
 * still usable.
 *
 * The account is created `ACTIVATE` with no verification code: receiving the
 * token at the invited address already proves control of that mailbox, which is
 * exactly what verification would establish.
 */
@Injectable()
export class AcceptAdminInvitationUseCase implements IAcceptAdminInvitationUseCase {
  constructor(
    @Inject(ADMIN_INVITATION_REPOSITORY)
    private readonly invitationRepository: IAdminInvitationRepository,
    @Inject(ADMIN_PERMISSION_REPOSITORY)
    private readonly adminPermissionRepository: IAdminPermissionRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly tokenService: AdminInvitationTokenService,
    private readonly hashingProvider: HashingProvider,
    private readonly clockService: ClockService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(AcceptAdminInvitationUseCase.name);
  }

  async execute(dto: AcceptAdminInvitationRequestDto): Promise<void> {
    const tokenHash = this.tokenService.hash(dto.token);

    const invitation =
      await this.invitationRepository.findByTokenHash(tokenHash);

    // A token that does not match and a token that was never issued are the
    // same answer, so the endpoint cannot be used to probe for live invitations.
    if (!invitation) {
      this.logger.warn(
        { event: LogEvent.ADMIN_INVITATION_REJECTED, reason: 'UNKNOWN_TOKEN' },
        'Administrator invitation acceptance rejected'
      );

      throw AuthorizationErrors.invitationNotFound();
    }

    const now = this.clockService.nowDate();

    try {
      AdminInvitationPolicy.assertAcceptable(invitation, now);
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: LogEvent.ADMIN_INVITATION_REJECTED,
          invitationId: invitation.id,
          status: AdminInvitationPolicy.statusOf(invitation, now)
        },
        'Administrator invitation acceptance rejected'
      );

      throw error;
    }

    // The single place a role is written still asks whether it may be assigned,
    // so OWNER can never arrive here however this use case is called.
    OwnerProtectionPolicy.assertRoleAssignable(UserRole.ADMIN);

    const password = await this.hashingProvider.hash(dto.password);

    let created: User;
    try {
      created = await this.dataSource.transaction(async (manager) => {
        const account = await this.userRepository.insertUser(
          {
            email: invitation.email,
            username: dto.username,
            password,
            name: dto.name ?? null,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVATE
          },
          manager
        );

        await this.adminPermissionRepository.grant(
          account.id,
          invitation.permissions,
          invitation.invitedById,
          manager
        );

        await this.invitationRepository.markAccepted(
          invitation.id,
          now,
          account.id,
          manager
        );

        return account;
      });
    } catch (error: unknown) {
      // A username taken between validation and insert, or an address whose
      // account was soft-deleted after the invitation was issued.
      throwOnUniqueConstraint(error);
    }

    this.logger.info(
      {
        event: LogEvent.ADMIN_INVITATION_ACCEPTED,
        invitationId: invitation.id,
        userId: created.id,
        permissions: invitation.permissions,
        invitedById: invitation.invitedById
      },
      'Administrator invitation accepted'
    );
  }
}
