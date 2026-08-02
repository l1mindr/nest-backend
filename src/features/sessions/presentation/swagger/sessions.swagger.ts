import { SessionErrors } from '@features/sessions/domain/errors/session-errors';
import {
  badRequestResponse,
  csrfForbiddenResponse,
  internalServerErrorResponse,
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
import { clearedCsrfCookieHeader } from '@presentation/swagger/cookie.headers';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { SESSION_PAGE_SIZE_MAX } from '../dto/request/session-list-request.dto';
import { SessionListResponseDto } from '../dto/response/session-list-response.dto';

/**
 * Operation documentation for `SessionsController`.
 *
 * All three endpoints act on the sessions of the authenticated account only —
 * there is no way to address another user's session, so none of them takes an
 * identifier.
 */

const PATH = {
  LIST: '/v1/sessions',
  REVOKE: '/v1/sessions',
  REVOKE_OTHERS: '/v1/sessions/others'
} as const;

const invalidCursor = () =>
  errorExample(
    SessionErrors.invalidCursor(),
    'Cursor is not valid base64url, or does not decode to a position this endpoint issued'
  );

export const ApiGetSessions = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listSessions',
      summary: 'List the devices signed in to the account',
      description: [
        'Returns the active sessions of the authenticated account, most recently used first. Revoked and expired sessions are omitted.',
        '',
        'The session the request was made with is returned separately as `currentSession` and is **never** included in `items`, so a client can render "this device" apart from the rest without having to match identifiers.',
        '',
        `Cursor-paginated, up to ${SESSION_PAGE_SIZE_MAX} per page. The refresh token hash behind each session is never exposed.`
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiDataResponse({
      status: 200,
      description:
        'The current session plus one page of the other active sessions.',
      type: SessionListResponseDto
    }),
    ApiErrorResponses(PATH.LIST, [
      badRequestResponse(
        'The `cursor` query parameter was not produced by this endpoint.',
        invalidCursor()
      ),
      unauthorizedResponse(),
      validationResponse('A pagination parameter is out of range.', [
        validationError(
          'limit',
          `limit must not be greater than ${SESSION_PAGE_SIZE_MAX}`
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiRevokeCurrentSession = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'revokeCurrentSession',
      summary: 'Sign out of the current session',
      description: [
        'Revokes the session behind the `access_token` cookie. Sessions on other devices are untouched — use `DELETE /v1/sessions/others` for those, or both to sign out everywhere.',
        '',
        'Only the readable `csrf_token` cookie is cleared by this response. The two `HttpOnly` token cookies are **not** cleared: they cannot be, and it would not matter if they were, because the session behind them is revoked server-side and they stop being accepted immediately. They linger in the browser until they expire on their own.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiNoContent({
      description:
        'Session revoked and the CSRF cookie expired. No body is returned.',
      headers: clearedCsrfCookieHeader()
    }),
    ApiErrorResponses(PATH.REVOKE, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      internalServerErrorResponse()
    ])
  );

export const ApiTerminateOtherSessions = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'terminateOtherSessions',
      summary: 'Sign out of every other device',
      description: [
        'Revokes every session of the account except the one making the request, which stays usable — the caller is not signed out and its cookies remain valid.',
        '',
        'Intended for the "sign out everywhere else" control after a device is lost. `POST /v1/auth/change-password` performs the same revocation automatically.',
        '',
        'Idempotent: revoking when no other session exists still returns `204`. The `csrf_token` cookie is deliberately left in place, since the calling session continues.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiNoContent({
      description:
        'All other sessions revoked; the calling session survives. No body is returned.'
    }),
    ApiErrorResponses(PATH.REVOKE_OTHERS, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      internalServerErrorResponse()
    ])
  );
