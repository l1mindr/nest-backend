import { applyDecorators } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
  badRequestResponse,
  unauthorizedResponse,
  validationError,
  validationResponse
} from '@presentation/swagger/api-error.catalog';
import {
  ApiErrorResponses,
  ApiSuccessResponse,
  errorExample
} from '@presentation/swagger/api-response.decorator';
import { ApiAuthenticated } from '@presentation/swagger/api-security.decorator';
import { ACTIVITY_RETENTION_DAYS } from '../../domain/activity-catalog';
import { ActivityCategory } from '../../domain/enums/activity-category.enum';
import { ActivityErrors } from '../../domain/errors/activity-errors';
import { ACTIVITY_PAGE_SIZE_MAX } from '../dto/request/list-user-activity.request.dto';
import { UserActivityListResponseDto } from '../dto/response/user-activity-list.response.dto';

/**
 * Operation documentation for `UserActivityController`.
 *
 * The endpoint is always scoped to the caller: there is no parameter that
 * selects a user, and the identity comes from the session cookie.
 */

const PATH = '/v1/user/activity';

const invalidCursor = () =>
  errorExample(
    ActivityErrors.invalidCursor(),
    'Cursor is not valid base64url, or does not decode to a position this endpoint issued'
  );

export const ApiListUserActivity = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listUserActivity',
      summary: 'List the authenticated account’s recent activity',
      description: [
        'Returns what the caller has done in the application, newest first — signing in, changing a password, revoking a session, and creating, updating or deleting portfolios, transactions and price alerts.',
        '',
        `**Retention.** Activities are kept for ${ACTIVITY_RETENTION_DAYS} days and then removed automatically by the database. There is no way to retrieve an older record, and no parameter extends the window.`,
        '',
        `**Category and action.** Each entry stores the two separately: \`category\` is the kind of thing (${Object.values(
          ActivityCategory
        ).join(
          ', '
        )}) and \`action\` is what happened to it. Filter with \`category\` to narrow to one kind.`,
        '',
        `**Pagination.** Cursor-based, up to ${ACTIVITY_PAGE_SIZE_MAX} per page. Pass the \`nextCursor\` of a response as \`cursor\` to fetch the page after it; \`nextCursor\` is \`null\` on the last page.`,
        '',
        '**Scope.** Only the caller’s own activities are returned. The account is taken from the authenticated session — this endpoint accepts no user identifier, and supplying one has no effect on the result.',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiSuccessResponse({
      status: 200,
      description:
        'One page of the caller’s activities, newest first. Empty `items` with a `null` `nextCursor` means there is nothing in the retention window.',
      type: UserActivityListResponseDto
    }),
    ApiErrorResponses(PATH, [
      badRequestResponse(
        'The `cursor` query parameter was not produced by this endpoint.',
        invalidCursor()
      ),
      unauthorizedResponse(),
      validationResponse(
        'A pagination or filter parameter is out of range or not a member of its enum.',
        [
          validationError(
            'limit',
            `limit must not be greater than ${ACTIVITY_PAGE_SIZE_MAX}`
          ),
          validationError(
            'category',
            `category must be one of the following values: ${Object.values(
              ActivityCategory
            ).join(', ')}`
          )
        ]
      )
    ])
  );
