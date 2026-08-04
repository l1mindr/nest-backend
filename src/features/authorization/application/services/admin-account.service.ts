import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { UserErrors } from '@features/users/domain/errors/user-errors';
import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/application/interfaces/users.interface';
import { Inject, Injectable } from '@nestjs/common';
import { AuthorizationErrors } from '../../domain/errors/authorization-errors';
import {
  OwnerProtectionPolicy,
  ProtectedAction
} from '../../domain/owner-protection.policy';
import { RoleHierarchy } from '../../domain/role-hierarchy';

/**
 * Resolves the account an administrative operation is aimed at, and refuses the
 * targets that operation must never touch.
 *
 * Every administrative use case starts with the same three questions — does the
 * account exist, is it the owner, is the caller aiming at themselves — and
 * getting any of them wrong is a privilege-escalation bug. Asking them in one
 * place means a new use case cannot forget one.
 */
@Injectable()
export class AdminAccountService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  /**
   * The target of an operation on an existing administrator: it must exist, be
   * an administrator, not be the owner, and not be the caller.
   *
   * Blocking self-targeting is what stops an administrator from widening their
   * own reach; the self-service endpoints remain available for anything they
   * are legitimately allowed to change about themselves.
   */
  async loadManageableAdmin(
    actorId: string,
    targetId: string,
    action: ProtectedAction
  ): Promise<User> {
    const target = await this.load(targetId);

    OwnerProtectionPolicy.assertNotOwner(target, action);
    OwnerProtectionPolicy.assertNotSelf(actorId, targetId, action);

    if (target.role !== UserRole.ADMIN) {
      throw AuthorizationErrors.notAnAdministrator(targetId);
    }

    return target;
  }

  /**
   * The target of a promotion: an ordinary account that is eligible to become
   * an administrator.
   *
   * Only an active account qualifies — promoting one that has never verified
   * its email would create an administrator nobody can sign in as, and
   * promoting a suspended one would quietly undo a moderation decision.
   */
  async loadPromotableUser(actorId: string, targetId: string): Promise<User> {
    const target = await this.load(targetId);

    OwnerProtectionPolicy.assertNotOwner(target, ProtectedAction.ROLE_CHANGE);
    OwnerProtectionPolicy.assertNotSelf(
      actorId,
      targetId,
      ProtectedAction.ROLE_CHANGE
    );

    if (RoleHierarchy.isAdministrative(target.role)) {
      throw AuthorizationErrors.alreadyAnAdministrator(targetId);
    }

    if (target.status !== UserStatus.ACTIVATE) {
      throw AuthorizationErrors.accountNotEligible(target.status);
    }

    return target;
  }

  /** Soft-deleted accounts are invisible here, so they cannot be administered. */
  private async load(targetId: string): Promise<User> {
    const target = await this.userRepository.findUserForAdmin(targetId);

    if (!target) throw UserErrors.userNotFound(targetId);

    return target;
  }
}
