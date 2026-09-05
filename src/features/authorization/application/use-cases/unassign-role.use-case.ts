import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/application/interfaces/users.interface';
import { UserErrors } from '@features/users/domain/errors/user-errors';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  OwnerProtectionPolicy,
  ProtectedAction
} from '../../domain/owner-protection.policy';
import {
  AuthorizationActor,
  IUnassignRoleUseCase,
  IUserRoleRepository,
  USER_ROLE_REPOSITORY
} from '../interfaces/authorization.interface';

/**
 * Removes a role from an account. A no-op if the account did not hold it, so
 * the endpoint is safe to replay.
 */
@Injectable()
export class UnassignRoleUseCase implements IUnassignRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: IUserRoleRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(UnassignRoleUseCase.name);
  }

  async execute(
    actor: AuthorizationActor,
    userId: string,
    roleId: string
  ): Promise<void> {
    const target = await this.userRepository.findUserForAdmin(userId);

    if (!target) throw UserErrors.userNotFound(userId);

    OwnerProtectionPolicy.assertNotOwner(target, ProtectedAction.ROLE_CHANGE);
    OwnerProtectionPolicy.assertNotSelf(
      actor.id,
      userId,
      ProtectedAction.ROLE_CHANGE
    );

    await this.userRoleRepository.unassign(userId, roleId);

    this.logger.info(
      {
        event: LogEvent.ROLE_UNASSIGNED,
        actorId: actor.id,
        userId,
        roleId
      },
      'Role removed from account'
    );
  }
}
