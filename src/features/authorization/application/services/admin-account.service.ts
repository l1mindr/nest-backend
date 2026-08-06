import { User } from '@features/users/domain/entities/user.entity';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { UserErrors } from '@features/users/domain/errors/user-errors';
import {
  IUserRepository,
  USER_REPOSITORY
} from '@features/users/application/interfaces/users.interface';
import { Inject, Injectable } from '@nestjs/common';
import {
  OwnerProtectionPolicy,
  ProtectedAction
} from '../../domain/owner-protection.policy';

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
   * an administrator, and not be the caller.
   *
   * An account outside the administrator population — an ordinary user, or the
   * owner — answers "not found" rather than explaining itself. That is what
   * keeps the owner invisible: an identifier harvested elsewhere cannot be used
   * here to confirm that it belongs to the owner, because the answer is the
   * same one an unused identifier gives.
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

    if (target.role !== UserRole.ADMIN) {
      throw UserErrors.userNotFound(targetId);
    }

    OwnerProtectionPolicy.assertNotSelf(actorId, targetId, action);

    return target;
  }

  /** Soft-deleted accounts are invisible here, so they cannot be administered. */
  private async load(targetId: string): Promise<User> {
    const target = await this.userRepository.findUserForAdmin(targetId);

    if (!target) throw UserErrors.userNotFound(targetId);

    return target;
  }
}
