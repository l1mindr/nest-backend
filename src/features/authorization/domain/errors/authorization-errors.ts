import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { HttpStatus } from '@nestjs/common';
import { Permission } from '../enums/permission.enum';
import { AuthorizationErrorCode } from './authorization-error-code.enum';

/**
 * Failures of the authorization model itself, as opposed to the plain
 * `ACCESS_DENIED` that `SecurityErrors` raises when a caller simply lacks a
 * permission. These say *why* an otherwise well-formed administrative request
 * is refused, because the answer is actionable: grant the permission, pick a
 * different target, ask the owner.
 */
export class AuthorizationErrors {
  /** Any attempt to suspend, delete, demote or edit the owner. */
  static ownerImmutable(action: string) {
    return new AppError(
      AuthorizationErrorCode.OWNER_IMMUTABLE,
      ErrorDomain.AUTHORIZATION,
      HttpStatus.FORBIDDEN,
      { action },
      'The owner account cannot be modified through this operation'
    );
  }

  static ownerAlreadyExists() {
    return new AppError(
      AuthorizationErrorCode.OWNER_ALREADY_EXISTS,
      ErrorDomain.AUTHORIZATION,
      HttpStatus.CONFLICT,
      undefined,
      'An owner already exists; the system allows exactly one'
    );
  }

  static ownerRoleNotAssignable() {
    return new AppError(
      AuthorizationErrorCode.OWNER_ROLE_NOT_ASSIGNABLE,
      ErrorDomain.AUTHORIZATION,
      HttpStatus.FORBIDDEN,
      { role: 'OWNER' },
      'The OWNER role cannot be assigned through the API'
    );
  }

  static notAnAdministrator(userId?: string) {
    return new AppError(
      AuthorizationErrorCode.NOT_AN_ADMINISTRATOR,
      ErrorDomain.AUTHORIZATION,
      HttpStatus.CONFLICT,
      userId ? { userId } : undefined,
      'The target account is not an administrator'
    );
  }

  static alreadyAnAdministrator(userId?: string) {
    return new AppError(
      AuthorizationErrorCode.ALREADY_AN_ADMINISTRATOR,
      ErrorDomain.AUTHORIZATION,
      HttpStatus.CONFLICT,
      userId ? { userId } : undefined,
      'The target account is already an administrator'
    );
  }

  /**
   * Raised whenever a caller aims an administrative operation at their own
   * account. Covers self-promotion, self-granting and self-demotion in one
   * rule, so none of them can be forgotten at a single call site.
   */
  static selfManagementForbidden(action: string) {
    return new AppError(
      AuthorizationErrorCode.SELF_MANAGEMENT_FORBIDDEN,
      ErrorDomain.AUTHORIZATION,
      HttpStatus.FORBIDDEN,
      { action },
      'Administrators cannot perform this operation on their own account'
    );
  }

  /** An administrator tried to hand out a permission they do not hold. */
  static permissionNotHeld(permissions: readonly Permission[]) {
    return new AppError(
      AuthorizationErrorCode.PERMISSION_NOT_HELD,
      ErrorDomain.AUTHORIZATION,
      HttpStatus.FORBIDDEN,
      { permissions: [...permissions] },
      'A permission cannot be granted by a caller who does not hold it'
    );
  }

  static accountNotEligible(status: string) {
    return new AppError(
      AuthorizationErrorCode.ACCOUNT_NOT_ELIGIBLE,
      ErrorDomain.AUTHORIZATION,
      HttpStatus.CONFLICT,
      { status },
      'Only an active account can be promoted to administrator'
    );
  }
}
