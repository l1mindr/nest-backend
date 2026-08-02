import { SecurityErrors } from '@features/security/errors/security-errors';
import { UserErrors } from '@features/users/domain/errors/user-errors';
import {
  adminForbiddenResponse,
  badRequestResponse,
  conflictResponse,
  csrfForbiddenResponse,
  forbiddenResponse,
  internalServerErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationError,
  validationResponse
} from '@presentation/swagger/api-error.catalog';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiNoContent,
  errorExample
} from '@presentation/swagger/api-response.decorator';
import {
  ApiAuthenticated,
  ApiCsrfProtected
} from '@presentation/swagger/api-security.decorator';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { ApiRequestBody } from '@presentation/swagger/api-request.decorator';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import { UserStatus } from '../../domain/enums/user-status.enum';
import { SuspendUserRequestDto } from '../dto/request/suspend-user.request.dto';
import { UpdateProfileRequestDto } from '../dto/request/update-profile.request.dto';
import { AdminUserResponseDto } from '../dto/response/admin-user.response.dto';
import { AdminUsersListResponseDto } from '../dto/response/admin-users-list.response.dto';
import { UserProfileResponseDto } from '../dto/response/user-profile.response.dto';

/**
 * Operation documentation for `UsersController` and `AdminUsersController`.
 *
 * The two are documented side by side because they project the same account
 * through different lenses: the self-service profile hides the moderation
 * state that the administrative view exists to expose.
 */

const PATH = {
  PROFILE: '/v1/user/me',
  UPDATE_PROFILE: '/v1/user',
  DELETE_ACCOUNT: '/v1/user/delete-account',
  ADMIN_LIST: '/v1/admin/users',
  ADMIN_GET: `/v1/admin/users/${ExampleValue.USER_ID}`,
  ADMIN_SUSPEND: `/v1/admin/users/${ExampleValue.USER_ID}/suspend`,
  ADMIN_UNSUSPEND: `/v1/admin/users/${ExampleValue.USER_ID}/unsuspend`
} as const;

/** The `:id` route parameter of the administrative endpoints. */
const userIdParam = () =>
  ApiParam({
    name: 'id',
    description:
      'Identifier of the account being administered, as returned in `id` by `GET /v1/admin/users`.',
    format: 'uuid',
    example: ExampleValue.USER_ID,
    required: true
  });

const userNotFound = () =>
  errorExample(
    UserErrors.userNotFound(ExampleValue.USER_ID),
    'No account exists with this identifier'
  );

/** `403` for the read-only administrative endpoints, which bypass CSRF. */
const adminReadForbidden = () =>
  forbiddenResponse(
    'The caller is authenticated but does not hold the `ADMIN` role.',
    errorExample(
      SecurityErrors.accessDenied(),
      'The account is not an administrator'
    )
  );

export const ApiGetProfile = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'getMyProfile',
      summary: 'Get the profile of the authenticated account',
      description: [
        'Returns the account behind the `access_token` cookie. There is no way to read another user through this endpoint — administrators use `GET /v1/admin/users/{id}`.',
        '',
        'The projection is deliberately narrow: the password hash, the moderation `status` and the soft-deletion instant are not exposed. `role` is included because it determines whether `/v1/admin/*` is reachable.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiDataResponse({
      status: 200,
      description: 'The profile of the authenticated account.',
      type: UserProfileResponseDto
    }),
    ApiErrorResponses(PATH.PROFILE, [
      unauthorizedResponse(),
      internalServerErrorResponse()
    ])
  );

export const ApiChangeProfile = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'updateMyProfile',
      summary: 'Update the profile of the authenticated account',
      description: [
        'Only the display name is editable. Email and username are immutable once the account exists, and the password is changed through `POST /v1/auth/change-password`, which additionally demands the current one.',
        '',
        'Send `name: null` to clear the display name. Every field is optional, so an empty body is accepted and simply changes nothing.',
        '',
        'No body is returned; re-read `GET /v1/user/me` if the updated projection is needed. Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiRequestBody(UpdateProfileRequestDto, [
      {
        summary: 'Set a display name',
        value: { name: ExampleValue.NAME }
      },
      {
        summary: 'Clear the display name',
        value: { name: null }
      }
    ]),
    ApiNoContent({ description: 'Profile updated. No body is returned.' }),
    ApiErrorResponses(PATH.UPDATE_PROFILE, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'The authenticated account no longer exists — it was deleted between the token being issued and this request.',
        userNotFound()
      ),
      validationResponse(
        'The body failed validation. Unknown properties are rejected outright rather than ignored.',
        [
          validationError(
            'name',
            'name must be shorter than or equal to 30 characters'
          )
        ]
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiDeleteAccount = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'deleteMyAccount',
      summary: 'Delete the authenticated account',
      description: [
        'Soft-deletes the account and revokes **every** session in the same transaction, so all devices are signed out immediately. The caller is signed out too: the cookies on this response are not cleared, but the tokens stop being accepted at once.',
        '',
        'The record is retained with a deletion timestamp rather than erased, and the email and username stay reserved — they cannot be re-registered.',
        '',
        'There is no undo through the API. Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiNoContent({
      description:
        'Account deleted and all sessions revoked. No body is returned.'
    }),
    ApiErrorResponses(PATH.DELETE_ACCOUNT, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'The authenticated account no longer exists — it has already been deleted.',
        userNotFound()
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminGetAllUsers = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'adminListUsers',
      summary: 'List every account',
      description: [
        'Cursor-paginated over all accounts ordered by identifier, **including soft-deleted ones** — the `deletedAt` field distinguishes them.',
        '',
        'Unlike the self-service profile, each entry carries the moderation `status` and both registry timestamps.',
        '',
        'Requires authentication and the `ADMIN` role.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiDataResponse({
      status: 200,
      description:
        'One page of accounts. `nextCursor` is `null` once the last page has been reached.',
      type: AdminUsersListResponseDto
    }),
    ApiErrorResponses(PATH.ADMIN_LIST, [
      badRequestResponse(
        'The `cursor` query parameter was not produced by this endpoint.',
        errorExample(
          UserErrors.invalidCursor(),
          'Cursor is not valid base64url, or does not decode to an identifier'
        )
      ),
      unauthorizedResponse(),
      adminReadForbidden(),
      validationResponse('A pagination parameter is out of range.', [
        validationError('limit', 'limit must not be greater than 100')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminGetUser = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'adminGetUser',
      summary: 'Get a single account by identifier',
      description: [
        'Returns the administrative projection of one account, including soft-deleted ones.',
        '',
        'Requires authentication and the `ADMIN` role.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    userIdParam(),
    ApiDataResponse({
      status: 200,
      description: 'The requested account.',
      type: AdminUserResponseDto
    }),
    ApiErrorResponses(PATH.ADMIN_GET, [
      unauthorizedResponse(),
      adminReadForbidden(),
      notFoundResponse(
        'No account exists with this identifier.',
        userNotFound()
      ),
      validationResponse('The `id` path parameter is not a UUID.', [
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminSuspendUser = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'adminSuspendUser',
      summary: 'Suspend an account',
      description: [
        'Moves the account to `SUSPEND` and revokes **every** session in the same transaction, signing the user out of all devices at once. A suspended account can no longer authenticate: login returns the generic `401 INVALID_CREDENTIALS` rather than disclosing the suspension.',
        '',
        'The `reason` is quoted verbatim in the notification email sent to the user, so it should be written for that audience. The email is sent after the transaction commits; a delivery failure does not roll the suspension back.',
        '',
        'Reverse it with `PATCH /v1/admin/users/{id}/unsuspend`.',
        '',
        'Requires authentication, the `ADMIN` role and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    userIdParam(),
    ApiRequestBody(SuspendUserRequestDto, [
      {
        summary: 'Suspend an account',
        value: {
          reason: 'Repeated violations of the acceptable use policy.'
        }
      }
    ]),
    ApiNoContent({
      description:
        'Account suspended, all its sessions revoked and the notification email dispatched. No body is returned.'
    }),
    ApiErrorResponses(PATH.ADMIN_SUSPEND, [
      unauthorizedResponse(),
      adminForbiddenResponse(),
      notFoundResponse(
        'No account exists with this identifier.',
        userNotFound()
      ),
      conflictResponse(
        'The account is already suspended, so there is nothing to do.',
        errorExample(
          UserErrors.userAlreadySuspended(),
          'Account is already in `SUSPEND`'
        )
      ),
      validationResponse('The path parameter or the body is malformed.', [
        validationError(
          'reason',
          'reason must be longer than or equal to 3 characters'
        ),
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiAdminUnsuspendUser = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'adminUnsuspendUser',
      summary: 'Lift the suspension on an account',
      description: [
        'Returns a `SUSPEND` account to `ACTIVATE` and emails the user to say so. Sessions are **not** restored — they were revoked when the suspension was applied, so the user must log in again.',
        '',
        'Only `SUSPEND` is a legal starting point. Attempting this on an active, deactivated or still-unverified account returns `409 INVALID_STATUS_TRANSITION`, whose `error.meta` reports the states involved.',
        '',
        'Requires authentication, the `ADMIN` role and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    userIdParam(),
    ApiNoContent({
      description:
        'Suspension lifted and the notification email dispatched. No body is returned.'
    }),
    ApiErrorResponses(PATH.ADMIN_UNSUSPEND, [
      unauthorizedResponse(),
      adminForbiddenResponse(),
      notFoundResponse(
        'No account exists with this identifier.',
        userNotFound()
      ),
      conflictResponse(
        'The account is not suspended, so the transition is not allowed.',
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
