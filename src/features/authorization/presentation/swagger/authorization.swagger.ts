import { SecurityErrors } from '@features/security/errors/security-errors';
import { UserErrors } from '@features/users/domain/errors/user-errors';
import { UserStatus } from '@features/users/domain/enums/user-status.enum';
import { SuspendUserRequestDto } from '@features/users/presentation/dto/request/suspend-user.request.dto';
import {
  badRequestResponse,
  conflictResponse,
  forbiddenResponse,
  goneResponse,
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
import { AcceptAdminInvitationRequestDto } from '../dto/request/accept-admin-invitation.request.dto';
import { CreateRoleRequestDto } from '../dto/request/create-role.request.dto';
import { InviteAdminRequestDto } from '../dto/request/invite-admin.request.dto';
import { PermissionSetRequestDto } from '../dto/request/permission-set.request.dto';
import { UpdateAdminRequestDto } from '../dto/request/update-admin.request.dto';
import { UpdateRoleRequestDto } from '../dto/request/update-role.request.dto';
import { AdminAccountResponseDto } from '../dto/response/admin-account.response.dto';
import { AdminAccountsListResponseDto } from '../dto/response/admin-accounts-list.response.dto';
import { AdminInvitationResponseDto } from '../dto/response/admin-invitation.response.dto';
import { AdminInvitationsListResponseDto } from '../dto/response/admin-invitations-list.response.dto';
import { EffectivePermissionsResponseDto } from '../dto/response/effective-permissions.response.dto';
import { PermissionCatalogResponseDto } from '../dto/response/permission-catalog.response.dto';
import { RoleResponseDto } from '../dto/response/role.response.dto';
import { RolesListResponseDto } from '../dto/response/roles-list.response.dto';

/**
 * Operation documentation for the administrator, invitation and permission
 * endpoints.
 *
 * One access rule recurs and is documented once here: `permissionRequired()`.
 * Routes reserved to the owner are not documented differently — they require an
 * owner-reserved permission, which is a permission nobody else can be granted.
 * `ownerReserved()` says so in the description without introducing a second
 * kind of gate.
 */

const ADMINS = '/v1/admin/administrators';
const INVITATIONS = `${ADMINS}/invitations`;

const PATH = {
  LIST: ADMINS,
  SELF: `${ADMINS}/me`,
  DETAIL: `${ADMINS}/${ExampleValue.ADMIN_ID}`,
  ACTIVATE: `${ADMINS}/${ExampleValue.ADMIN_ID}/activate`,
  DEACTIVATE: `${ADMINS}/${ExampleValue.ADMIN_ID}/deactivate`,
  SUSPEND: `${ADMINS}/${ExampleValue.ADMIN_ID}/suspend`,
  UNSUSPEND: `${ADMINS}/${ExampleValue.ADMIN_ID}/unsuspend`,
  PERMISSIONS: `${ADMINS}/${ExampleValue.ADMIN_ID}/permissions`,
  INVITATIONS,
  INVITATION_DETAIL: `${INVITATIONS}/${ExampleValue.USER_ID}`,
  INVITATION_ACCEPT: `${INVITATIONS}/accept`,
  CATALOG: '/v1/admin/permissions',
  MINE: '/v1/admin/permissions/me',
  ROLES: '/v1/admin/roles',
  ROLE_DETAIL: `/v1/admin/roles/${ExampleValue.ADMIN_ID}`,
  ROLE_PERMISSIONS: `/v1/admin/roles/${ExampleValue.ADMIN_ID}/permissions`,
  USER_ROLES: `/v1/admin/users/${ExampleValue.USER_ID}/roles`,
  USER_ROLE_DETAIL: `/v1/admin/users/${ExampleValue.USER_ID}/roles/${ExampleValue.ADMIN_ID}`
} as const;

const roleIdParam = () =>
  ApiParam({
    name: 'id',
    description: `Identifier of the role, as returned in \`id\` by \`GET ${PATH.ROLES}\`.`,
    format: 'uuid',
    example: ExampleValue.ADMIN_ID,
    required: true
  });

const userIdParam = () =>
  ApiParam({
    name: 'id',
    description: 'Identifier of the account, as a UUID.',
    format: 'uuid',
    example: ExampleValue.USER_ID,
    required: true
  });

const roleRefParam = () =>
  ApiParam({
    name: 'roleId',
    description: 'Identifier of the role, as a UUID.',
    format: 'uuid',
    example: ExampleValue.ADMIN_ID,
    required: true
  });

const roleNotFound = () =>
  notFoundResponse(
    'No role exists with this identifier.',
    errorExample(AuthorizationErrors.roleNotFound(), 'Unknown role')
  );

const roleProtected = (action: 'RENAME' | 'PERMISSION_CHANGE' | 'DELETE') =>
  errorExample(
    AuthorizationErrors.roleProtected(action),
    'The role is a system role (OWNER, ADMIN or USER) and cannot be modified'
  );

const adminIdParam = () =>
  ApiParam({
    name: 'id',
    description: `Identifier of the administrator being administered, as returned in \`id\` by \`GET ${ADMINS}\`.`,
    format: 'uuid',
    example: ExampleValue.ADMIN_ID,
    required: true
  });

const invitationIdParam = () =>
  ApiParam({
    name: 'id',
    description: `Identifier of the invitation, as returned in \`id\` by \`GET ${INVITATIONS}\`.`,
    format: 'uuid',
    example: ExampleValue.USER_ID,
    required: true
  });

const accountNotFound = () =>
  errorExample(
    UserErrors.userNotFound(ExampleValue.USER_ID),
    'No account exists with this identifier'
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

/**
 * The paragraph appended to every operation whose permission is owner-reserved.
 * Written once so the reason is stated identically everywhere it applies.
 */
const ownerReserved = (permission: Permission) =>
  `Requires \`${permission}\`, which is reserved to the owner: it cannot be granted to an administrator, so in practice only the owner may call this. An administrator able to create or unmake administrators would hold every permission by proxy. Relaxing this is a change to the permission catalog, not to the route.`;

export const ApiAdminList = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listAdministrators',
      summary: 'List administrators and the permissions they hold',
      description: [
        'Cursor-paginated over accounts holding the `ADMIN` role, ordered by identifier. The owner is never listed, for anyone — the owner is not an administrator but the tier above one, and is excluded by the query rather than filtered from the result.',
        '',
        'Administrators cannot see one another: `ADMIN_READ` is owner-reserved, so this endpoint answers `403` to every administrator. `GET /me` is where an administrator reads their own profile.',
        '',
        'Each entry carries its grants, which is the only thing that decides what that administrator can actually reach. An empty `permissions` array is a real state, not a placeholder — it means the account holds the role and nothing else.',
        '',
        ownerReserved(Permission.ADMIN_READ)
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

export const ApiAdminSelf = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'getOwnAdministratorProfile',
      summary: 'Get your own administrator profile and permissions',
      description: [
        'The one administrator endpoint scoped to the caller, and therefore the one that needs no permission: it can only ever return the account making the request.',
        '',
        'This is what an administrator reads instead of the directory. `GET /v1/admin/administrators` is owner-reserved, so an administrator cannot enumerate their peers; here they see themselves and the grants that decide what they can reach.',
        '',
        'The owner may call it too and is reported as holding every permission, which is how they are actually treated — they bypass evaluation rather than being granted anything.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiSuccessResponse({
      status: 200,
      description: 'The calling administrator.',
      type: AdminAccountResponseDto
    }),
    ApiErrorResponses(PATH.SELF, [
      unauthorizedResponse(),
      forbiddenResponse(
        'The caller is an ordinary user, which has no administrator profile to return.',
        errorExample(
          SecurityErrors.accessDenied(),
          'The caller holds neither `ADMIN` nor `OWNER`'
        )
      ),
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
        'The owner is resolvable only by the owner. To anyone else an owner identifier answers `404` — the same answer an identifier that was never issued gives — so this endpoint cannot be used to confirm which account is the owner. Ordinary users answer the same way, for the same reason.',
        '',
        ownerReserved(Permission.ADMIN_READ)
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
        'No administrator exists with this identifier, or it identifies an account the caller may not resolve.',
        accountNotFound()
      ),
      validationResponse('The `id` path parameter is not a UUID.', [
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminInvitationCreate = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'inviteAdministrator',
      summary: 'Invite someone to become an administrator',
      description: [
        'Issues a single-use, time-limited invitation to an email address and sends the token to it. **No account is created here.**',
        '',
        'That is the point of the flow: a promotion-based design has to create the privileged account up front, so a revoked or forgotten invitation leaves a dormant administrator account behind that can still be signed into. Here the account comes into existence only when the invitee accepts and sets their own password — until then the only trace is an invitation row and an email.',
        '',
        'The token is generated from a CSPRNG and only its SHA-256 digest is stored, so a database dump yields nothing that can be presented. It is returned in no response, including this one.',
        '',
        'At most one invitation is outstanding per address: re-inviting an address supersedes the previous invitation rather than adding a second. The address must not already belong to an account.',
        '',
        'Delivery failure does not roll the invitation back — the owner can revoke and re-issue, whereas a rollback would leave them unable to tell whether the address is now invited.',
        '',
        ownerReserved(Permission.ADMIN_INVITE)
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiRequestBody(InviteAdminRequestDto, [
      {
        summary: 'Invite a read-only administrator',
        value: {
          email: ExampleValue.EMAIL,
          permissions: [Permission.USER_READ]
        }
      },
      {
        summary: 'Invite a moderator',
        value: {
          email: ExampleValue.EMAIL,
          permissions: [Permission.USER_READ, Permission.USER_SUSPEND]
        }
      },
      {
        summary: 'Invite with no permissions yet',
        value: { email: ExampleValue.EMAIL }
      }
    ]),
    ApiSuccessResponse({
      status: 201,
      description:
        'The invitation as issued. The token is not included — it exists only in the delivered email.',
      type: AdminInvitationResponseDto
    }),
    ApiErrorResponses(PATH.INVITATIONS, [
      unauthorizedResponse(),
      permissionRequired(Permission.ADMIN_INVITE),
      conflictResponse(
        'The address already belongs to an account.',
        errorExample(
          UserErrors.emailAlreadyExists(),
          'Administrators are always new accounts, so a taken address is refused'
        )
      ),
      validationResponse('The body failed validation.', [
        validationError('email', 'email must be an email'),
        validationError(
          'permissions',
          'permissions must contain only delegable permission codes; owner-reserved permissions cannot be granted'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminInvitationList = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listAdministratorInvitations',
      summary: 'List administrator invitations',
      description: [
        'The invitation log, cursor-paginated and ordered by identifier. Settled invitations are kept and listed: revoking or accepting one does not erase the fact that it was issued, which is what makes this an audit trail rather than a work queue.',
        '',
        '`status` is derived at read time — an invitation whose `expiresAt` has passed reports `EXPIRED` without anything having updated the row.',
        '',
        ownerReserved(Permission.ADMIN_INVITE)
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiSuccessResponse({
      status: 200,
      description:
        'One page of invitations. `nextCursor` is `null` once the last page has been reached.',
      type: AdminInvitationsListResponseDto
    }),
    ApiErrorResponses(PATH.INVITATIONS, [
      badRequestResponse(
        'The `cursor` query parameter was not produced by this endpoint.',
        errorExample(
          UserErrors.invalidCursor(),
          'Cursor is not valid base64url, or does not decode to an identifier'
        )
      ),
      unauthorizedResponse(),
      permissionRequired(Permission.ADMIN_INVITE),
      validationResponse('A pagination parameter is out of range.', [
        validationError('limit', 'limit must not be greater than 100')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminInvitationRevoke = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'revokeAdministratorInvitation',
      summary: 'Revoke a pending invitation',
      description: [
        'Withdraws an invitation before it is used. The token stops being accepted immediately.',
        '',
        'The row is marked revoked rather than deleted, so the audit trail still shows that an invitation was issued and thought better of.',
        '',
        'An expired invitation may still be revoked — that is how the owner clears the way to re-invite the same address. An already accepted or already revoked one cannot: there is nothing left to withdraw, and revoking an accepted invitation would not unmake the account it created. Delete the administrator instead.',
        '',
        ownerReserved(Permission.ADMIN_INVITE)
      ].join('\n')
    }),
    ApiCsrfProtected(),
    invitationIdParam(),
    ApiNoContent({ description: 'Invitation revoked. No body is returned.' }),
    ApiErrorResponses(PATH.INVITATION_DETAIL, [
      unauthorizedResponse(),
      permissionRequired(Permission.ADMIN_INVITE),
      notFoundResponse(
        'No invitation exists with this identifier.',
        errorExample(
          AuthorizationErrors.invitationNotFound(),
          'Unknown invitation'
        )
      ),
      conflictResponse(
        'The invitation has already been settled.',
        errorExample(
          AuthorizationErrors.invitationNotPending(),
          'Already accepted or already revoked'
        )
      ),
      validationResponse('The `id` path parameter is not a UUID.', [
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminInvitationAccept = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'acceptAdministratorInvitation',
      summary: 'Accept an invitation and create the administrator account',
      description: [
        'The only endpoint that creates an administrator, and the only one in this group that is unauthenticated — the invitee has no account yet, so the token is the entire proof of who they are.',
        '',
        'Creating the account, granting the invited permissions and burning the invitation happen in one transaction. If any step fails none of it happened and the token is still usable.',
        '',
        'The email is taken from the invitation, never from the request: the token is what proves control of that address. The account is created `ACTIVATE` with no verification code, because receiving the token at the invited address already establishes exactly what verification would.',
        '',
        'Single use. A token that has been accepted, revoked or expired is refused, and so is one that was never issued — an unknown token and a wrong token give the same `404`, so this endpoint cannot be used to probe for live invitations.'
      ].join('\n')
    }),
    ApiRequestBody(AcceptAdminInvitationRequestDto, [
      {
        summary: 'Accept and set credentials',
        value: {
          token: 'x7Qk2m9YbR4tG1hV8sN0wP3jL6cA5dE2fU9iO4yZ1kM',
          username: ExampleValue.USERNAME,
          password: ExampleValue.PASSWORD,
          name: ExampleValue.NAME
        }
      }
    ]),
    ApiNoContent({
      description:
        'Account created with the invited permissions and the invitation burned. Sign in normally. No body is returned.'
    }),
    ApiErrorResponses(PATH.INVITATION_ACCEPT, [
      notFoundResponse(
        'The token does not match a known invitation. Deliberately indistinguishable from a token that never existed.',
        errorExample(
          AuthorizationErrors.invitationNotFound(),
          'Unknown or mistyped token'
        )
      ),
      conflictResponse(
        'The invitation cannot be accepted, or the chosen username is taken.',
        errorExample(
          AuthorizationErrors.invitationNotPending(),
          'Already accepted, or revoked by the owner'
        ),
        errorExample(
          UserErrors.usernameAlreadyExists(),
          'The chosen username belongs to another account'
        )
      ),
      goneResponse(
        'The invitation expired before it was accepted. Ask the owner to issue a new one.',
        errorExample(
          AuthorizationErrors.invitationExpired(),
          'Past `expiresAt`'
        )
      ),
      validationResponse('The body failed validation.', [
        validationError('password', 'password is not strong enough'),
        validationError(
          'token',
          'token must be longer than or equal to 40 characters'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminDelete = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'deleteAdministrator',
      summary: 'Delete an administrator',
      description: [
        'Soft-deletes the account, drops every permission it held and revokes all of its sessions, in one transaction.',
        '',
        'Administrators are created by invitation and were never ordinary users, so there is no earlier state to fall back to. Demoting one to `USER` would push an account into the user population that never belonged there, and it would surface in user management as a result — deletion is the honest end of an administrator.',
        '',
        'Sessions are revoked because an access token issued before the deletion would otherwise keep being judged by the role recorded on it.',
        '',
        'The owner cannot be reached through this route, and neither can the caller themselves.',
        '',
        ownerReserved(Permission.ADMIN_DELETE)
      ].join('\n')
    }),
    ApiCsrfProtected(),
    adminIdParam(),
    ApiNoContent({
      description:
        'Administrator deleted, permissions dropped and sessions revoked. No body is returned.'
    }),
    ApiErrorResponses(PATH.DETAIL, [
      unauthorizedResponse(),
      permissionRequired(
        Permission.ADMIN_DELETE,
        selfManagement(ProtectedAction.DELETE)
      ),
      notFoundResponse(
        'No administrator exists with this identifier. The owner and ordinary users answer the same way.',
        accountNotFound()
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
    permissionRequired(
      Permission.ADMIN_STATUS,
      selfManagement(ProtectedAction.STATUS_CHANGE)
    ),
    notFoundResponse(
      'No administrator exists with this identifier. The owner and ordinary users answer the same way.',
      accountNotFound()
    ),
    conflictResponse(
      'The administrator is not in a state this transition can start from.',
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
        ownerReserved(Permission.ADMIN_STATUS)
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
        ownerReserved(Permission.ADMIN_STATUS)
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
        'Scoped to the administrator population: an ordinary user identifier answers `404` here, just as an administrator identifier does on the user suspension route. Neither route can reach the owner.',
        '',
        `Reverse it with \`PATCH ${ADMINS}/{id}/unsuspend\`.`,
        '',
        ownerReserved(Permission.ADMIN_STATUS)
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
      permissionRequired(Permission.ADMIN_STATUS),
      notFoundResponse(
        'No administrator exists with this identifier. The owner and ordinary users answer the same way.',
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
        ownerReserved(Permission.ADMIN_STATUS)
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
      permissionRequired(Permission.ADMIN_STATUS),
      notFoundResponse(
        'No administrator exists with this identifier. The owner and ordinary users answer the same way.',
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
      validationResponse('The body failed validation.', [
        validationError(
          'permissions',
          'permissions must contain only delegable permission codes; owner-reserved permissions cannot be granted'
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
      validationResponse('The body failed validation.', [
        validationError(
          'permissions',
          'permissions must contain only delegable permission codes; owner-reserved permissions cannot be granted'
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

export const ApiRoleList = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listRoles',
      summary: 'List every role in the catalog',
      description: [
        'Every role — the three system roles (`OWNER`, `ADMIN`, `USER`) and every custom role — together with the permissions each one grants.',
        '',
        'A role is a second, additive source of permissions layered on top of direct grants: it can only ever add reach to an account, never take any away.',
        '',
        ownerReserved(Permission.ROLE_READ)
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiSuccessResponse({
      status: 200,
      description: 'Every role, ordered by name.',
      type: RolesListResponseDto
    }),
    ApiErrorResponses(PATH.ROLES, [
      unauthorizedResponse(),
      permissionRequired(Permission.ROLE_READ),
      internalServerErrorResponse()
    ])
  );

export const ApiRoleGet = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'getRole',
      summary: 'Get one role and the permissions it grants'
    }),
    ApiAuthenticated(),
    roleIdParam(),
    ApiSuccessResponse({
      status: 200,
      description: 'The requested role.',
      type: RoleResponseDto
    }),
    ApiErrorResponses(PATH.ROLE_DETAIL, [
      unauthorizedResponse(),
      permissionRequired(Permission.ROLE_READ),
      roleNotFound(),
      validationResponse('The `id` path parameter is not a UUID.', [
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiRoleCreate = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'createRole',
      summary: 'Create a role',
      description: [
        'Creates a role with no permissions. Add permissions afterward with `PUT /v1/admin/roles/{id}/permissions`.',
        '',
        ownerReserved(Permission.ROLE_CREATE)
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiRequestBody(CreateRoleRequestDto, [
      {
        summary: 'Create a support role',
        value: {
          name: 'SUPPORT',
          description: 'Read-only access to the user directory.'
        }
      }
    ]),
    ApiSuccessResponse({
      status: 201,
      description: 'The role as created, holding no permissions yet.',
      type: RoleResponseDto
    }),
    ApiErrorResponses(PATH.ROLES, [
      unauthorizedResponse(),
      permissionRequired(Permission.ROLE_CREATE),
      conflictResponse(
        'A role with this name already exists.',
        errorExample(
          AuthorizationErrors.roleNameConflict('SUPPORT'),
          'Role names are unique'
        )
      ),
      validationResponse('The body failed validation.', [
        validationError(
          'name',
          'name must be uppercase snake case, starting with a letter (e.g. SUPPORT, READ_ONLY)'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiRoleUpdate = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'updateRole',
      summary: 'Rename a role or edit its description',
      description: [
        'System roles (`OWNER`, `ADMIN`, `USER`) cannot be renamed or re-described.',
        '',
        ownerReserved(Permission.ROLE_UPDATE)
      ].join('\n')
    }),
    ApiCsrfProtected(),
    roleIdParam(),
    ApiRequestBody(UpdateRoleRequestDto, [
      { summary: 'Rename a role', value: { name: 'SUPPORT_L1' } }
    ]),
    ApiNoContent({ description: 'Role updated. No body is returned.' }),
    ApiErrorResponses(PATH.ROLE_DETAIL, [
      unauthorizedResponse(),
      permissionRequired(Permission.ROLE_UPDATE),
      roleNotFound(),
      forbiddenResponse('The role is a system role.', roleProtected('RENAME')),
      conflictResponse(
        'A role with this name already exists.',
        errorExample(
          AuthorizationErrors.roleNameConflict('SUPPORT_L1'),
          'Role names are unique'
        )
      ),
      validationResponse('The body failed validation.', [
        validationError(
          'name',
          'name must be uppercase snake case, starting with a letter (e.g. SUPPORT, READ_ONLY)'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiRoleDelete = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'deleteRole',
      summary: 'Delete a role',
      description: [
        'Refused while any account is still assigned to this role — remove the assignments first. System roles can never be deleted.',
        '',
        ownerReserved(Permission.ROLE_DELETE)
      ].join('\n')
    }),
    ApiCsrfProtected(),
    roleIdParam(),
    ApiNoContent({ description: 'Role deleted. No body is returned.' }),
    ApiErrorResponses(PATH.ROLE_DETAIL, [
      unauthorizedResponse(),
      permissionRequired(Permission.ROLE_DELETE),
      roleNotFound(),
      forbiddenResponse('The role is a system role.', roleProtected('DELETE')),
      conflictResponse(
        'One or more accounts are still assigned to this role.',
        errorExample(
          AuthorizationErrors.roleHasAssignments(),
          'Unassign every account from the role first'
        )
      ),
      validationResponse('The `id` path parameter is not a UUID.', [
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiRoleSetPermissions = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'setRolePermissions',
      summary: 'Replace the permissions a role grants',
      description: [
        'Replaces the full set in one transaction — whatever is not named here is removed from the role, whatever is missing is added.',
        '',
        'The caller must already hold every permission being placed into the role, exactly as when granting one directly. System roles cannot have their permissions changed.',
        '',
        ownerReserved(Permission.ROLE_UPDATE)
      ].join('\n')
    }),
    ApiCsrfProtected(),
    roleIdParam(),
    ApiRequestBody(PermissionSetRequestDto, [
      {
        summary: 'Grant read-only access to users',
        value: { permissions: [Permission.USER_READ] }
      }
    ]),
    ApiNoContent({
      description: 'Permission set replaced. No body is returned.'
    }),
    ApiErrorResponses(PATH.ROLE_PERMISSIONS, [
      unauthorizedResponse(),
      permissionRequired(Permission.ROLE_UPDATE),
      roleNotFound(),
      forbiddenResponse(
        'The role is a system role.',
        roleProtected('PERMISSION_CHANGE')
      ),
      validationResponse('The body failed validation.', [
        validationError(
          'permissions',
          'permissions must contain only delegable permission codes; owner-reserved permissions cannot be granted'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiUserRolesList = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listUserRoles',
      summary: 'List the roles assigned to an account',
      description: ownerReserved(Permission.ROLE_READ)
    }),
    ApiAuthenticated(),
    userIdParam(),
    ApiSuccessResponse({
      status: 200,
      description: 'Every role assigned to this account.',
      type: RolesListResponseDto
    }),
    ApiErrorResponses(PATH.USER_ROLES, [
      unauthorizedResponse(),
      permissionRequired(Permission.ROLE_READ),
      notFoundResponse(
        'No account exists with this identifier.',
        accountNotFound()
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiUserRoleAssign = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'assignRole',
      summary: 'Assign a role to an account',
      description: [
        'Idempotent — assigning a role the account already holds is not an error.',
        '',
        'Not restricted to administrators: any non-owner account may receive a role. The owner cannot be a target, and the caller cannot target their own account.',
        '',
        'The caller must already hold every permission the role grants, exactly as when granting a permission directly.',
        '',
        ownerReserved(Permission.ROLE_ASSIGN)
      ].join('\n')
    }),
    ApiCsrfProtected(),
    userIdParam(),
    roleRefParam(),
    ApiNoContent({ description: 'Role assigned. No body is returned.' }),
    ApiErrorResponses(PATH.USER_ROLE_DETAIL, [
      unauthorizedResponse(),
      permissionRequired(
        Permission.ROLE_ASSIGN,
        ...delegationErrors(ProtectedAction.ROLE_CHANGE)
      ),
      roleNotFound(),
      notFoundResponse(
        'No account exists with this identifier.',
        accountNotFound()
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiUserRoleUnassign = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'unassignRole',
      summary: 'Remove a role from an account',
      description: [
        'A no-op if the account did not hold the role, so the request is safe to replay.',
        '',
        ownerReserved(Permission.ROLE_ASSIGN)
      ].join('\n')
    }),
    ApiCsrfProtected(),
    userIdParam(),
    roleRefParam(),
    ApiNoContent({ description: 'Role removed. No body is returned.' }),
    ApiErrorResponses(PATH.USER_ROLE_DETAIL, [
      unauthorizedResponse(),
      permissionRequired(
        Permission.ROLE_ASSIGN,
        ownerImmutable(ProtectedAction.ROLE_CHANGE),
        selfManagement(ProtectedAction.ROLE_CHANGE)
      ),
      notFoundResponse(
        'No account exists with this identifier.',
        accountNotFound()
      ),
      internalServerErrorResponse()
    ])
  );
