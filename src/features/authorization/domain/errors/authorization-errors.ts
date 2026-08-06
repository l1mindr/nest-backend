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

  static ownerRoleNotAssignable() {
    return new AppError(
      AuthorizationErrorCode.OWNER_ROLE_NOT_ASSIGNABLE,
      ErrorDomain.AUTHORIZATION,
      HttpStatus.FORBIDDEN,
      { role: 'OWNER' },
      'The OWNER role cannot be assigned through the API'
    );
  }

  /**
   * Raised whenever a caller aims an administrative operation at their own
   * account. Covers self-granting and self-demotion in one rule, so neither can
   * be forgotten at a single call site.
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

  /**
   * A permission reserved to the owner was aimed at somebody else. Refused for
   * every caller, the owner included: the point of the reservation is that no
   * account other than the owner can ever hold it.
   */
  static permissionReservedToOwner(permissions: readonly Permission[]) {
    return new AppError(
      AuthorizationErrorCode.PERMISSION_RESERVED_TO_OWNER,
      ErrorDomain.AUTHORIZATION,
      HttpStatus.FORBIDDEN,
      { permissions: [...permissions] },
      'This permission is reserved to the owner and cannot be granted'
    );
  }

  /**
   * Deliberately indistinguishable from a token that never existed, so the
   * acceptance endpoint cannot be used to probe for live invitations.
   */
  static invitationNotFound() {
    return new AppError(
      AuthorizationErrorCode.INVITATION_NOT_FOUND,
      ErrorDomain.AUTHORIZATION,
      HttpStatus.NOT_FOUND,
      undefined,
      'Invitation not found'
    );
  }

  static invitationNotPending() {
    return new AppError(
      AuthorizationErrorCode.INVITATION_NOT_PENDING,
      ErrorDomain.AUTHORIZATION,
      HttpStatus.CONFLICT,
      undefined,
      'This invitation has already been accepted or revoked'
    );
  }

  static invitationExpired() {
    return new AppError(
      AuthorizationErrorCode.INVITATION_EXPIRED,
      ErrorDomain.AUTHORIZATION,
      HttpStatus.GONE,
      undefined,
      'This invitation has expired'
    );
  }
}
