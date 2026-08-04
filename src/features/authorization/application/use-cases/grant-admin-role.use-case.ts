import { UserRole } from '@features/users/domain/enums/user-role.enum';
import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/application/interfaces/users.interface';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { CreateAdminRequestDto } from '../../presentation/dto/request/create-admin.request.dto';
import { OwnerProtectionPolicy } from '../../domain/owner-protection.policy';
import { AdminAccountService } from '../services/admin-account.service';
import {
  ADMIN_PERMISSION_REPOSITORY,
  AdminAccount,
  IAdminPermissionRepository,
  IGrantAdminRoleUseCase
} from '../interfaces/authorization.interface';

/**
 * Promotes an existing account to administrator, optionally with an initial set
 * of permissions.
 *
 * Administrators are ordinary accounts holding the `ADMIN` role rather than a
 * separate kind of identity, so this promotes rather than registers: sign-up,
 * email verification and password handling stay on the single path they already
 * follow, and no endpoint here can mint credentials for someone else.
 *
 * Reserved to the owner. The role change and the initial grants share a
 * transaction so a promotion cannot land half-applied, leaving an administrator
 * whose permissions were silently dropped.
 */
@Injectable()
export class GrantAdminRoleUseCase implements IGrantAdminRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ADMIN_PERMISSION_REPOSITORY)
    private readonly adminPermissionRepository: IAdminPermissionRepository,
    private readonly adminAccountService: AdminAccountService,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(GrantAdminRoleUseCase.name);
  }

  async execute(
    actorId: string,
    { userId, permissions = [] }: CreateAdminRequestDto
  ): Promise<AdminAccount> {
    const target = await this.adminAccountService.loadPromotableUser(
      actorId,
      userId
    );

    // The role is fixed here rather than taken from the request, so today this
    // cannot fail. It is asserted anyway because this is the one place the
    // administrative API writes a role: should the role ever become an input,
    // the rule that OWNER is unassignable is already standing in front of it.
    OwnerProtectionPolicy.assertRoleAssignable(UserRole.ADMIN);

    await this.dataSource.transaction(async (manager) => {
      await this.userRepository.updateRole(userId, UserRole.ADMIN, manager);
      await this.adminPermissionRepository.grant(
        userId,
        permissions,
        actorId,
        manager
      );
    });

    this.logger.info(
      {
        event: LogEvent.ADMIN_ROLE_GRANTED,
        actorId,
        userId,
        permissions
      },
      'Account promoted to administrator'
    );

    target.role = UserRole.ADMIN;

    return { account: target, permissions };
  }
}
