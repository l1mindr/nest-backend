import {
  badRequestResponse,
  csrfForbiddenResponse,
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
import { CoinTrackerErrors } from '../../domain/errors/coin-tracker-errors';
import { COIN_PAGE_SIZE_MAX } from '../dto/request/coin-list.request.dto';
import { CreatePriceAlertRequestDto } from '../dto/request/create-price-alert.request.dto';
import { PRICE_ALERT_PAGE_SIZE_MAX } from '../dto/request/list-price-alerts.request.dto';
import { UpdatePriceAlertRequestDto } from '../dto/request/update-price-alert.request.dto';
import { CoinListResponseDto } from '../dto/response/coin-list.response.dto';
import { PriceAlertListResponseDto } from '../dto/response/price-alert-list.response.dto';
import { PriceAlertResponseDto } from '../dto/response/price-alert.response.dto';

/**
 * Operation documentation for `CoinsController` and `PriceAlertsController`.
 *
 * Alerts are always scoped to the authenticated user: an alert belonging to
 * someone else is reported as `404`, never as `403`, so ownership cannot be
 * probed by identifier.
 */

const PATH = {
  COINS: '/v1/coins',
  ALERTS: '/v1/price-alerts',
  ALERT: `/v1/price-alerts/${ExampleValue.PRICE_ALERT_ID}`
} as const;

/** The `:id` route parameter of the single-alert endpoints. */
const alertIdParam = () =>
  ApiParam({
    name: 'id',
    description:
      'Identifier of the price alert, as returned in `id` by `GET /v1/price-alerts`.',
    format: 'uuid',
    example: ExampleValue.PRICE_ALERT_ID,
    required: true
  });

const alertNotFound = () =>
  errorExample(
    CoinTrackerErrors.priceAlertNotFound(ExampleValue.PRICE_ALERT_ID),
    'No such alert, or it belongs to another account'
  );

const invalidCursor = () =>
  errorExample(
    CoinTrackerErrors.invalidCursor(),
    'Cursor is not valid base64url, or does not decode to a position this endpoint issued'
  );

export const ApiGetCoins = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listCoins',
      summary: 'Search the catalogue of supported cryptocurrencies',
      description: [
        'Lists the coins synchronised from CoinGecko, which are the only ones a price alert can be created against. The `id` of an entry here is what `POST /v1/price-alerts` expects as `coinId`.',
        '',
        'Pass `search` to match a case-insensitive substring against both the coin name and its ticker symbol.',
        '',
        `Cursor-paginated, up to ${COIN_PAGE_SIZE_MAX} per page. The cursor encodes the \`sortBy\` and \`sortOrder\` it was produced under: changing either mid-traversal invalidates it and returns \`400 INVALID_CURSOR\`, rather than silently returning a page ordered by something else.`,
        '',
        'Inactive coins are still listed — check `isActive`, since alerts can only be created against active ones. Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiDataResponse({
      status: 200,
      description:
        'One page of coins, ordered by the requested sort field. `nextCursor` is `null` on the last page.',
      type: CoinListResponseDto
    }),
    ApiErrorResponses(PATH.COINS, [
      badRequestResponse(
        'The `cursor` is unusable, most often because `sortBy` or `sortOrder` changed between pages.',
        invalidCursor()
      ),
      unauthorizedResponse(),
      validationResponse(
        'A pagination, search or sorting parameter is out of range or not a member of its enum.',
        [
          validationError(
            'limit',
            `limit must not be greater than ${COIN_PAGE_SIZE_MAX}`
          ),
          validationError(
            'sortBy',
            'sortBy must be one of the following values: id, name, symbol'
          )
        ]
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiCreatePriceAlert = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'createPriceAlert',
      summary: 'Create a price alert',
      description: [
        'Watches one coin and notifies the owner when its price crosses `targetPrice` in the given `direction`: `BUY` fires when the price falls to or below the threshold, `SELL` when it rises to or above it.',
        '',
        'A **crossing** is what fires the alert, not a level. The first evaluation only records the current price, so creating a `SELL` alert below the market price does not fire it immediately — the price has to move across the threshold afterwards.',
        '',
        '`ONCE` alerts move to `TRIGGERED` on the first crossing and stop being evaluated. `REPEAT` alerts stay `ACTIVE` and notify again on each subsequent crossing, no more often than the notification cooldown allows.',
        '',
        'The coin must exist and still be active. `expiresAt` is optional; when given it must be strictly in the future.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiRequestBody(CreatePriceAlertRequestDto, [
      {
        summary: 'Watch Bitcoin cross a ceiling',
        value: {
          coinId: 'bitcoin',
          targetPrice: 120000,
          direction: 'SELL',
          triggerMode: 'ONCE',
          expiresAt: ExampleValue.EXPIRES_AT,
          notificationChannels: ['EMAIL']
        }
      },
      {
        summary: 'Repeat EMAIL and SMS notifications on dips',
        value: {
          coinId: 'ethereum',
          targetPrice: 2500,
          direction: 'BUY',
          triggerMode: 'REPEAT',
          notificationChannels: ['EMAIL', 'SMS']
        }
      }
    ]),
    ApiDataResponse({
      status: 201,
      description:
        'The alert was created in `ACTIVE` and is returned with its coin resolved.',
      type: PriceAlertResponseDto
    }),
    ApiErrorResponses(PATH.ALERTS, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'No active coin matches `coinId`. Confirm it against `GET /v1/coins`.',
        errorExample(
          CoinTrackerErrors.coinNotFound('bitcoin'),
          'The coin is unknown or has been deactivated'
        )
      ),
      validationResponse(
        'The body failed validation, or the expiry is not in the future.',
        [
          errorExample(
            CoinTrackerErrors.invalidExpiration(),
            '`expiresAt` is in the past or is the current instant'
          ),
          validationError(
            'targetPrice',
            'targetPrice must be a positive number'
          ),
          validationError(
            'notificationChannels',
            'notificationChannels should not be empty'
          )
        ]
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiListPriceAlerts = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listPriceAlerts',
      summary: 'List the price alerts of the authenticated account',
      description: [
        'Returns only alerts owned by the caller. Every state is included by default — filter with `status` to see just the `ACTIVE` ones, and with `direction` or `coinId` to narrow further.',
        '',
        `Cursor-paginated, up to ${PRICE_ALERT_PAGE_SIZE_MAX} per page. Each entry carries its coin resolved inline, so listing alerts does not require a second call to \`GET /v1/coins\`.`,
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiDataResponse({
      status: 200,
      description:
        'One page of the caller’s alerts. `nextCursor` is `null` on the last page.',
      type: PriceAlertListResponseDto
    }),
    ApiErrorResponses(PATH.ALERTS, [
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
            `limit must not be greater than ${PRICE_ALERT_PAGE_SIZE_MAX}`
          ),
          validationError(
            'status',
            'status must be one of the following values: ACTIVE, TRIGGERED, EXPIRED, CANCELLED'
          )
        ]
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiUpdatePriceAlert = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'updatePriceAlert',
      summary: 'Update an active price alert',
      description: [
        'Partially updates an alert the caller owns. Every field is optional but the body may not be empty — `{}` is rejected with `422 EMPTY_UPDATE`.',
        '',
        'Only `ACTIVE` alerts can be updated. Cancelled, expired and triggered alerts are immutable; create a new alert instead. An alert whose expiry has quietly passed is moved to `EXPIRED` by this request before it is rejected.',
        '',
        'Changing `targetPrice` or `direction` clears `lastCheckedPrice`, so the next evaluation re-establishes which side of the threshold the price is on rather than reporting a crossing that never happened.',
        '',
        '`coinId` cannot be changed — an alert stays with the coin it was created for. `notificationChannels` replaces the existing set outright rather than merging into it.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    alertIdParam(),
    ApiRequestBody(UpdatePriceAlertRequestDto, [
      {
        summary: 'Raise the target and flip the direction',
        value: {
          targetPrice: 130000,
          direction: 'BUY'
        }
      },
      {
        summary: 'Add SMS to the notification set',
        value: {
          notificationChannels: ['EMAIL', 'SMS']
        }
      }
    ]),
    ApiDataResponse({
      status: 200,
      description: 'The updated alert, re-read after the write.',
      type: PriceAlertResponseDto
    }),
    ApiErrorResponses(PATH.ALERT, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'No alert with this identifier belongs to the caller. Alerts owned by another account are reported the same way, so ownership cannot be probed.',
        alertNotFound()
      ),
      validationResponse(
        'The body was empty or malformed, or the alert is in a state that cannot be updated.',
        [
          errorExample(
            CoinTrackerErrors.emptyUpdate(),
            'The body contained no updatable field'
          ),
          errorExample(
            CoinTrackerErrors.priceAlertExpired(ExampleValue.PRICE_ALERT_ID),
            'The alert has passed its expiry'
          ),
          errorExample(
            CoinTrackerErrors.priceAlertCancelled(ExampleValue.PRICE_ALERT_ID),
            'The alert was cancelled'
          ),
          errorExample(
            CoinTrackerErrors.priceAlertTriggered(ExampleValue.PRICE_ALERT_ID),
            'A `ONCE` alert has already fired'
          ),
          errorExample(
            CoinTrackerErrors.invalidExpiration(),
            'The new `expiresAt` is not in the future'
          ),
          validationError(
            'targetPrice',
            'targetPrice must be a positive number'
          )
        ]
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiCancelPriceAlert = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'cancelPriceAlert',
      summary: 'Cancel a price alert',
      description: [
        'Moves an alert the caller owns to `CANCELLED`, after which it is no longer evaluated. The record is kept and still appears in `GET /v1/price-alerts` unless filtered out by `status`.',
        '',
        'Not idempotent: cancelling an already-cancelled or expired alert returns `422`. A `TRIGGERED` alert, by contrast, can still be cancelled — which is how a `REPEAT` alert that has fired is stopped.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    alertIdParam(),
    ApiNoContent({
      description: 'The alert is now cancelled. No body is returned.'
    }),
    ApiErrorResponses(PATH.ALERT, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'No alert with this identifier belongs to the caller.',
        alertNotFound()
      ),
      validationResponse(
        'The alert is in a state that cannot be cancelled, or the `id` is not a UUID.',
        [
          errorExample(
            CoinTrackerErrors.priceAlertCancelled(ExampleValue.PRICE_ALERT_ID),
            'The alert was already cancelled'
          ),
          errorExample(
            CoinTrackerErrors.priceAlertExpired(ExampleValue.PRICE_ALERT_ID),
            'The alert has already expired'
          ),
          validationError('id', 'id must be a UUID')
        ]
      ),
      internalServerErrorResponse()
    ])
  );
