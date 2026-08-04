import { SecurityErrors } from '@features/security/errors/security-errors';
import { UserErrors } from '@features/users/domain/errors/user-errors';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { SuspendUserRequestDto } from '@features/users/presentation/dto/request/suspend-user.request.dto';
import {
  badRequestResponse,
  conflictResponse,
  forbiddenResponse,
  internalServerErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationError,
  validationResponse
} from '@presentation/swagger/api-error.catalog';
import {
  ApiErrorExample,
  ApiErrorResponses,
  ApiNoContent,
  ApiSuccessResponse,
  errorExample
} from '@presentation/swagger/api-response.decorator';
import {
  ApiAuthenticated,
  ApiCsrfProtected
} from '@presentation/swagger/api-security.decorator';
import { ApiRequestBody } from '@presentation/swagger/api-request.decorator';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { AuthorizationErrors } from '../../domain/errors/authorization-errors';
import { Permission } from '../../domain/enums/permission.enum';
import { ProtectedAction } from '../../domain/owner-protection.policy';
import { CreateAdminRequestDto } from '../dto/request/create-admin.request.dto';
import { PermissionSetRequestDto } from '../dto/request/permission-set.request.dto';
import { UpdateAdminRequestDto } from '../dto/request/update-admin.request.dto';
import { AdminAccountResponseDto } from '../dto/response/admin-account.response.dto';
import { AdminAccountsListResponseDto } from '../dto/response/admin-accounts-list.response.dto';
import { EffectivePermissionsResponseDto } from '../dto/response/effective-permissions.response.dto';
import { PermissionCatalogResponseDto } from '../dto/response/permission-catalog.response.dto';

/**
 * Operation documentation for the administrator and permission endpoints.
 *
 * Two access rules recur and are documented once here: `ownerOnly()` for the
 * lifecycle operations reserved to the owner, and `permissionRequired()` for
 * everything the owner can delegate.
 */

const PATH = {
  LIST: '/v1/admin/admins',
  CREATE: '/v1/admin/admins',
  DETAIL: `/v1/admin/admins/${ExampleValue.ADMIN_ID}`,
  ACTIVATE: `/v1/admin/admins/${ExampleValue.ADMIN_ID}/activate`,
  DEACTIVATE: `/v1/admin/admins/${ExampleValue.ADMIN_ID}/deactivate`,
  SUSPEND: `/v1/admin/admins/${ExampleValue.ADMIN_ID}/suspend`,
  UNSUSPEND: `/v1/admin/admins/${ExampleValue.ADMIN_ID}/unsuspend`,
  PERMISSIONS: `/v1/admin/admins/${ExampleValue.ADMIN_ID}/permissions`,
  CATALOG: '/v1/admin/permissions',
  MINE: '/v1/admin/permissions/me'
} as const;

const adminIdParam = () =>
  ApiParam({
    name: 'id',
    description:
      'Identifier of the administrator being administered, as returned in `id` by `GET /v1/admin/admins`.',
    format: 'uuid',
    example: ExampleValue.ADMIN_ID,
    required: true
  });

const accountNotFound = () =>
  errorExample(
    UserErrors.userNotFound(ExampleValue.USER_ID),
    'No account exists with this identifier'
  );

const notAnAdministrator = () =>
  errorExample(
    AuthorizationErrors.notAnAdministrator(ExampleValue.USER_ID),
    'The account exists but does not hold the `ADMIN` role'
  );

const ownerImmutable = (action: ProtectedAction) =>
  errorExample(
    AuthorizationErrors.ownerImmutable(action),
    'The target is the owner, which this operation may never touch'
  );

const selfManagement = (action: ProtectedAction) =>
  errorExample(
    AuthorizationErrors.selfManagementForbidden(action),
    'An administrator aimed the operation at their own account'
  );

/** `403` for a route reserved to the owner by role. */
const ownerOnly = (...extra: ApiErrorExample[]) =>
  forbiddenResponse(
    'Reserved to the owner. Administrators are refused here no matter which permissions they hold, because an administrator able to create or unmake administrators would hold every permission by proxy.',
    errorExample(SecurityErrors.accessDenied(), 'The caller is not the owner'),
    ...extra
  );

/** `403` for a route gated on a permission. */
const permissionRequired = (
  permission: Permission,
  ...extra: ApiErrorExample[]
) =>
  forbiddenResponse(
    `Requires the \`${permission}\` permission, or the owner, who bypasses evaluation. The CSRF check produces the same status on state-changing routes.`,
    errorExample(
      SecurityErrors.accessDenied(),
      `The caller does not hold \`${permission}\``
    ),
    ...extra
  );

export const ApiAdminList = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listAdministrators',
      summary: 'List administrators and the permissions they hold',
      description: [
        'Cursor-paginated over accounts holding the `ADMIN` role, ordered by identifier. The owner is not listed: the owner is not an administrator but the tier above one, and holds every permission unconditionally.',
        '',
        'Each entry carries its grants, which is the only thing that decides what that administrator can actually reach. An empty `permissions` array is a real state, not a placeholder — it means the account holds the role and nothing else.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiSuccessResponse({
      status: 200,
      description:
        'One page of administrators. `nextCursor` is `null` once the last page has been reached.',
      type: AdminAccountsListResponseDto
    }),
    ApiErrorResponses(PATH.LIST, [
      badRequestResponse(
        'The `cursor` query parameter was not produced by this endpoint.',
        errorExample(
          UserErrors.invalidCursor(),
          'Cursor is not valid base64url, or does not decode to an identifier'
        )
      ),
      unauthorizedResponse(),
      permissionRequired(Permission.ADMIN_READ),
      validationResponse('A pagination parameter is out of range.', [
        validationError('limit', 'limit must not be greater than 100')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminGet = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'getAdministrator',
      summary: 'Get one administrator and their permissions',
      description: [
        'Returns a single administrator together with the permissions granted to them.',
        '',
        'The owner can be read through this endpoint and is reported as holding every permission, which is how they are actually treated: they bypass evaluation rather than being granted anything.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    adminIdParam(),
    ApiSuccessResponse({
      status: 200,
      description: 'The requested administrator.',
      type: AdminAccountResponseDto
    }),
    ApiErrorResponses(PATH.DETAIL, [
      unauthorizedResponse(),
      permissionRequired(Permission.ADMIN_READ),
      notFoundResponse(
        'No account exists with this identifier.',
        accountNotFound()
      ),
      conflictResponse(
        'The account exists but is not an administrator.',
        notAnAdministrator()
      ),
      validationResponse('The `id` path parameter is not a UUID.', [
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminCreate = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'createAdministrator',
      summary: 'Promote an account to administrator',
      description: [
        'Grants the `ADMIN` role to an existing, active account and optionally assigns its opening set of permissions, in one transaction.',
        '',
        "This promotes rather than registers. An administrator is an ordinary account holding a role, not a separate kind of identity, so sign-up, email verification and password handling stay on the single path they already follow — and no endpoint here can mint credentials on someone else's behalf.",
        '',
        'Only an `ACTIVATE` account qualifies: promoting an unverified one would create an administrator nobody can sign in as, and promoting a suspended one would quietly undo a moderation decision.',
        '',
        'Reserved to the owner. `OWNER` is not an assignable role through any endpoint.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiRequestBody(CreateAdminRequestDto, [
      {
        summary: 'Promote with a read-only permission set',
        value: {
          userId: ExampleValue.USER_ID,
          permissions: [Permission.USER_READ]
        }
      },
      {
        summary: 'Promote a moderator',
        value: {
          userId: ExampleValue.USER_ID,
          permissions: [Permission.USER_READ, Permission.USER_SUSPEND]
        }
      },
      {
        summary: 'Promote with no permissions yet',
        value: { userId: ExampleValue.USER_ID }
      }
    ]),
    ApiSuccessResponse({
      status: 201,
      description: 'The newly promoted administrator.',
      type: AdminAccountResponseDto
    }),
    ApiErrorResponses(PATH.CREATE, [
      unauthorizedResponse(),
      ownerOnly(
        ownerImmutable(ProtectedAction.ROLE_CHANGE),
        selfManagement(ProtectedAction.ROLE_CHANGE)
      ),
      notFoundResponse(
        'No account exists with this identifier.',
        accountNotFound()
      ),
      conflictResponse(
        'The account cannot be promoted in its current state.',
        errorExample(
          AuthorizationErrors.alreadyAnAdministrator(ExampleValue.USER_ID),
          'The account already holds an administrative role'
        ),
        errorExample(
          AuthorizationErrors.accountNotEligible(
            UserStatus.PENDING_VERIFICATION
          ),
          'The account is not active, so it cannot be promoted'
        )
      ),
      validationResponse('The body is malformed.', [
        validationError('userId', 'userId must be a UUID'),
        validationError(
          'permissions',
          'each value in permissions must be one of the following values: USER_READ, USER_CREATE, ...'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminDelete = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'deleteAdministrator',
      summary: 'Withdraw administrator status',
      description: [
        'Drops the account back to `USER`, deletes every permission it held and revokes all of its sessions, in one transaction.',
        '',
        "The account itself survives. Removing administrative reach and deleting a person's account are separate decisions, and merging them would mean the owner could not demote a colleague without destroying their data. Account deletion stays on `DELETE /v1/user/delete-account`.",
        '',
        'Sessions are revoked because an access token issued before the demotion would otherwise keep being judged by the role recorded on it.',
        '',
        'Reserved to the owner. The owner cannot be demoted through any endpoint.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    adminIdParam(),
    ApiNoContent({
      description:
        'Administrator status withdrawn, permissions deleted and sessions revoked. No body is returned.'
    }),
    ApiErrorResponses(PATH.DETAIL, [
      unauthorizedResponse(),
      ownerOnly(
        ownerImmutable(ProtectedAction.ROLE_CHANGE),
        selfManagement(ProtectedAction.ROLE_CHANGE)
      ),
      notFoundResponse(
        'No account exists with this identifier.',
        accountNotFound()
      ),
      conflictResponse(
        'The account is not an administrator, so there is nothing to withdraw.',
        notAnAdministrator()
      ),
      validationResponse('The `id` path parameter is not a UUID.', [
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminUpdate = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'updateAdministrator',
      summary: "Edit another administrator's profile",
      description: [
        "Only the display name is editable, exactly as on the self-service profile. Email and username stay immutable and the password is never settable by another account — an administrator who could rewrite a colleague's credentials could take that account over outright.",
        '',
        "Refused against the owner, and against the caller's own account: `PUT /v1/user` already covers what an administrator may change about themselves."
      ].join('\n')
    }),
    ApiCsrfProtected(),
    adminIdParam(),
    ApiRequestBody(UpdateAdminRequestDto, [
      { summary: 'Set a display name', value: { name: ExampleValue.NAME } },
      { summary: 'Clear the display name', value: { name: null } }
    ]),
    ApiNoContent({ description: 'Profile updated. No body is returned.' }),
    ApiErrorResponses(PATH.DETAIL, [
      unauthorizedResponse(),
      permissionRequired(
        Permission.ADMIN_UPDATE,
        ownerImmutable(ProtectedAction.PROFILE_UPDATE),
        selfManagement(ProtectedAction.PROFILE_UPDATE)
      ),
      notFoundResponse(
        'No account exists with this identifier.',
        accountNotFound()
      ),
      conflictResponse(
        'The account is not an administrator.',
        notAnAdministrator()
      ),
      validationResponse('The body failed validation.', [
        validationError(
          'name',
          'name must be shorter than or equal to 30 characters'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

const statusChangeErrors = (path: string, from: UserStatus, to: UserStatus) =>
  ApiErrorResponses(path, [
    unauthorizedResponse(),
    ownerOnly(
      ownerImmutable(ProtectedAction.STATUS_CHANGE),
      selfManagement(ProtectedAction.STATUS_CHANGE)
    ),
    notFoundResponse(
      'No account exists with this identifier.',
      accountNotFound()
    ),
    conflictResponse(
      'The administrator is not in a state this transition can start from.',
      notAnAdministrator(),
      errorExample(
        UserErrors.invalidStatusTransition(from, to),
        `Only a ${from} administrator can be moved to ${to}`
      )
    ),
    validationResponse('The `id` path parameter is not a UUID.', [
      validationError('id', 'id must be a UUID')
    ]),
    internalServerErrorResponse()
  ]);

export const ApiAdminActivate = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'activateAdministrator',
      summary: 'Restore a deactivated administrator',
      description: [
        'Moves a `DEACTIVATE` administrator back to `ACTIVATE`. Role and permissions are untouched — they were never removed.',
        '',
        'Only deactivation is reversible here. Lifting a suspension is a separate decision with its own notification, and an account that never verified its email must still do so.',
        '',
        'Reserved to the owner.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    adminIdParam(),
    ApiNoContent({
      description: 'Administrator reactivated. No body is returned.'
    }),
    statusChangeErrors(
      PATH.ACTIVATE,
      UserStatus.DEACTIVATE,
      UserStatus.ACTIVATE
    )
  );

export const ApiAdminDeactivate = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'deactivateAdministrator',
      summary: "Switch off an administrator's access",
      description: [
        'Moves an `ACTIVATE` administrator to `DEACTIVATE` and revokes every session, in one transaction. The role and the permissions are kept, so reactivating restores the account exactly as it was.',
        '',
        'This is the reversible lever — a colleague on leave, an account under investigation — as distinct from suspension, which is a moderation decision that emails the user.',
        '',
        'Reserved to the owner.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    adminIdParam(),
    ApiNoContent({
      description:
        'Administrator deactivated and all sessions revoked. No body is returned.'
    }),
    statusChangeErrors(
      PATH.DEACTIVATE,
      UserStatus.ACTIVATE,
      UserStatus.DEACTIVATE
    )
  );

export const ApiAdminSuspend = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'suspendAdministrator',
      summary: 'Suspend an administrator',
      description: [
        'Identical in effect to suspending any other account — the same status transition, the same session revocation, the same notification email — because it is the same operation, reached through a route the owner alone may call.',
        '',
        'Reverse it with `PATCH /v1/admin/admins/{id}/unsuspend`. Reserved to the owner; the owner cannot be suspended.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    adminIdParam(),
    ApiRequestBody(SuspendUserRequestDto, [
      {
        summary: 'Suspend an administrator',
        value: { reason: 'Access under review following a security incident.' }
      }
    ]),
    ApiNoContent({
      description:
        'Administrator suspended, sessions revoked and the notification email dispatched. No body is returned.'
    }),
    ApiErrorResponses(PATH.SUSPEND, [
      unauthorizedResponse(),
      ownerOnly(ownerImmutable(ProtectedAction.SUSPEND)),
      notFoundResponse(
        'No account exists with this identifier.',
        accountNotFound()
      ),
      conflictResponse(
        'The account is already suspended.',
        errorExample(
          UserErrors.userAlreadySuspended(),
          'Account is already in `SUSPEND`'
        )
      ),
      validationResponse('The path parameter or the body is malformed.', [
        validationError(
          'reason',
          'reason must be longer than or equal to 3 characters'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminUnsuspend = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'unsuspendAdministrator',
      summary: 'Lift the suspension on an administrator',
      description: [
        'Returns a `SUSPEND` administrator to `ACTIVATE` and emails them to say so. Sessions are not restored — they were revoked when the suspension was applied.',
        '',
        'Reserved to the owner.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    adminIdParam(),
    ApiNoContent({
      description:
        'Suspension lifted and the notification email dispatched. No body is returned.'
    }),
    ApiErrorResponses(PATH.UNSUSPEND, [
      unauthorizedResponse(),
      ownerOnly(ownerImmutable(ProtectedAction.UNSUSPEND)),
      notFoundResponse(
        'No account exists with this identifier.',
        accountNotFound()
      ),
      conflictResponse(
        'The administrator is not suspended, so the transition is not allowed.',
        errorExample(
          UserErrors.invalidStatusTransition(
            UserStatus.ACTIVATE,
            UserStatus.ACTIVATE
          ),
          'Account is already active rather than suspended'
        )
      ),
      validationResponse('The `id` path parameter is not a UUID.', [
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

const delegationErrors = (action: ProtectedAction) => [
  ownerImmutable(action),
  selfManagement(action),
  errorExample(
    AuthorizationErrors.permissionNotHeld([Permission.SYSTEM_SETTINGS]),
    'The caller does not hold a permission they are trying to pass on'
  )
];

export const ApiAdminGrantPermissions = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'grantPermissions',
      summary: 'Grant permissions to an administrator',
      description: [
        'Adds permissions to another administrator. Idempotent — re-granting one they already hold is not an error.',
        '',
        'A caller may only pass on permissions they hold themselves. Without that limit, `ROLE_ASSIGN` alone would amount to holding every permission: grant the rest to a colleague, then have them grant those back. The owner passes trivially, holding everything.',
        '',
        'The caller cannot aim this at their own account, and the owner cannot be a target.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    adminIdParam(),
    ApiRequestBody(PermissionSetRequestDto, [
      {
        summary: 'Grant the ability to suspend accounts',
        value: { permissions: [Permission.USER_SUSPEND] }
      }
    ]),
    ApiNoContent({ description: 'Permissions granted. No body is returned.' }),
    ApiErrorResponses(PATH.PERMISSIONS, [
      unauthorizedResponse(),
      permissionRequired(
        Permission.ROLE_ASSIGN,
        ...delegationErrors(ProtectedAction.PERMISSION_GRANT)
      ),
      notFoundResponse(
        'No account exists with this identifier.',
        accountNotFound()
      ),
      conflictResponse(
        'The account is not an administrator, so it cannot hold permissions.',
        notAnAdministrator()
      ),
      validationResponse('The body failed validation.', [
        validationError(
          'permissions',
          'permissions must contain at least 1 elements'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminRevokePermissions = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'revokePermissions',
      summary: 'Revoke permissions from an administrator',
      description: [
        'Removes permissions from another administrator. Revoking one they never held is a no-op, so the request is safe to replay.',
        '',
        'Held to the same limit as granting: a caller can only revoke what they themselves hold, which stops a narrowly-scoped administrator with `ROLE_ASSIGN` from disarming a colleague whose reach exceeds their own.',
        '',
        "Takes effect on the target's very next request — grants are read per request rather than carried in their token."
      ].join('\n')
    }),
    ApiCsrfProtected(),
    adminIdParam(),
    ApiRequestBody(PermissionSetRequestDto, [
      {
        summary: 'Revoke the ability to suspend accounts',
        value: { permissions: [Permission.USER_SUSPEND] }
      }
    ]),
    ApiNoContent({ description: 'Permissions revoked. No body is returned.' }),
    ApiErrorResponses(PATH.PERMISSIONS, [
      unauthorizedResponse(),
      permissionRequired(
        Permission.ROLE_ASSIGN,
        ...delegationErrors(ProtectedAction.PERMISSION_REVOKE)
      ),
      notFoundResponse(
        'No account exists with this identifier.',
        accountNotFound()
      ),
      conflictResponse(
        'The account is not an administrator.',
        notAnAdministrator()
      ),
      validationResponse('The body failed validation.', [
        validationError(
          'permissions',
          'each value in permissions must be a valid enum value'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiListPermissions = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listPermissions',
      summary: 'List every permission the system can evaluate',
      description: [
        'The catalog, read from the database rather than from a compiled-in list, so a permission introduced by migration is visible to operators without a redeploy.',
        '',
        'These codes are exactly what the grant endpoints accept.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiSuccessResponse({
      status: 200,
      description: 'Every permission, ordered by code.',
      type: PermissionCatalogResponseDto
    }),
    ApiErrorResponses(PATH.CATALOG, [
      unauthorizedResponse(),
      permissionRequired(Permission.ADMIN_READ),
      internalServerErrorResponse()
    ])
  );

export const ApiMyPermissions = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'getMyPermissions',
      summary: 'Get the permissions of the authenticated account',
      description: [
        'Reports what the caller can do right now, so a client can drive its navigation from the same answer the server enforces instead of inferring reach from the role.',
        '',
        'Open to any authenticated account and always scoped to the caller. An ordinary user sees an empty list; the owner sees every permission, which is how they are actually treated.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiSuccessResponse({
      status: 200,
      description: 'The role and permissions of the calling account.',
      type: EffectivePermissionsResponseDto
    }),
    ApiErrorResponses(PATH.MINE, [
      unauthorizedResponse(),
      internalServerErrorResponse()
    ])
  );
