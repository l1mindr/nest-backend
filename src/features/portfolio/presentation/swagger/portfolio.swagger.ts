import {
  csrfForbiddenResponse,
  internalServerErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationError,
  validationResponse
} from '@presentation/swagger/api-error.catalog';
import {
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
import {
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  getSchemaPath
} from '@nestjs/swagger';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import { CreateHoldingRequestDto } from '../dto/request/create-holding.request.dto';
import { CreatePortfolioRequestDto } from '../dto/request/create-portfolio.request.dto';
import { UpdateHoldingRequestDto } from '../dto/request/update-holding.request.dto';
import { HoldingListResponseDto } from '../dto/response/holding-list.response.dto';
import { HoldingResponseDto } from '../dto/response/holding.response.dto';
import { PortfolioResponseDto } from '../dto/response/portfolio.response.dto';
import { PortfolioValuationResponseDto } from '../dto/response/portfolio-valuation.response.dto';

/**
 * Operation documentation for `PortfoliosController` and `HoldingsController`.
 *
 * Every resource is scoped to the authenticated user: a portfolio or holding
 * owned by someone else is reported as `404`, never as `403`, so ownership
 * cannot be probed by identifier.
 */

const PATH = {
  PORTFOLIOS: '/v1/portfolios',
  HOLDINGS: '/v1/holdings',
  HOLDING: `/v1/holdings/${ExampleValue.HOLDING_ID}`,
  VALUATION: `/v1/portfolios/${ExampleValue.PORTFOLIO_ID}/valuation`
} as const;

/** The `:id` route parameter of the single-holding endpoints. */
const holdingIdParam = () =>
  ApiParam({
    name: 'id',
    description:
      'Identifier of the holding, as returned in `id` by `GET /v1/holdings`.',
    format: 'uuid',
    example: ExampleValue.HOLDING_ID,
    required: true
  });

/** The `:id` route parameter of the single-portfolio endpoint. */
const portfolioIdParam = () =>
  ApiParam({
    name: 'id',
    description:
      'Identifier of the portfolio source, as returned in `id` by `GET /v1/portfolios`.',
    format: 'uuid',
    example: ExampleValue.PORTFOLIO_ID,
    required: true
  });

const portfolioNotFound = () =>
  errorExample(
    PortfolioErrors.portfolioNotFound(ExampleValue.PORTFOLIO_ID),
    'No such portfolio source, or it belongs to another account'
  );

const holdingNotFound = () =>
  errorExample(
    PortfolioErrors.holdingNotFound(ExampleValue.HOLDING_ID),
    'No such holding, or it belongs to another account'
  );

const assetNotFound = () =>
  errorExample(
    PortfolioErrors.assetNotFound(ExampleValue.ASSET_ID),
    'The asset is not part of the synchronised catalogue'
  );

const holdingConflict = () =>
  errorExample(
    PortfolioErrors.holdingAlreadyExists(),
    'The same asset is already held in this portfolio source'
  );

const emptyUpdate = () =>
  errorExample(
    PortfolioErrors.holdingEmptyUpdate(),
    'The body contained no updatable field'
  );

export const ApiCreatePortfolio = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'createPortfolio',
      summary: 'Create a portfolio source',
      description: [
        'Adds a wallet or exchange to the caller’s portfolio. A source has a display `name`, a `sourceType`, and an optional `walletAddress`.',
        '',
        'Names are not unique per account — the same wallet can appear twice under different names.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiRequestBody(CreatePortfolioRequestDto, [
      {
        summary: 'Add a Ledger hardware wallet',
        value: {
          name: 'Ledger Nano X',
          sourceType: 'LEDGER',
          walletAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
        }
      },
      {
        summary: 'Add an exchange account',
        value: {
          name: 'Kraken',
          sourceType: 'EXCHANGE'
        }
      }
    ]),
    ApiSuccessResponse({
      status: 201,
      description: 'The portfolio source was created and is returned in full.',
      type: PortfolioResponseDto
    }),
    ApiErrorResponses(PATH.PORTFOLIOS, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      validationResponse('The body failed validation.', [
        validationError(
          'name',
          'name must be longer than or equal to 1 characters'
        ),
        validationError(
          'sourceType',
          'sourceType must be one of the following values: LEDGER, EXCHANGE, WALLET, OTHER'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiListPortfolios = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listPortfolios',
      summary: 'List the portfolio sources of the authenticated account',
      description: [
        'Returns the caller’s portfolio sources in reverse creation order. Each entry is a summary; holdings are listed separately under `GET /v1/holdings`.',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiExtraModels(PortfolioResponseDto),
    ApiResponse({
      status: 200,
      description: 'Every portfolio source owned by the caller.',
      schema: {
        type: 'array',
        items: { $ref: getSchemaPath(PortfolioResponseDto) }
      }
    }),
    ApiErrorResponses(PATH.PORTFOLIOS, [
      unauthorizedResponse(),
      internalServerErrorResponse()
    ])
  );

export const ApiGetPortfolio = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'getPortfolio',
      summary: 'Get a portfolio source by id',
      description: [
        'Returns the portfolio source with the given `id` when it belongs to the caller.',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    portfolioIdParam(),
    ApiSuccessResponse({
      status: 200,
      description: 'The portfolio source owned by the caller.',
      type: PortfolioResponseDto
    }),
    ApiErrorResponses(PATH.PORTFOLIOS, [
      unauthorizedResponse(),
      notFoundResponse(
        'No portfolio source with this identifier belongs to the caller. Sources owned by another account are reported the same way, so ownership cannot be probed.',
        portfolioNotFound()
      ),
      validationResponse('The `id` is not a UUID.', [
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiGetPortfolioValuation = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'getPortfolioValuation',
      summary: 'Value a portfolio source by id',
      description: [
        'Computes the current value of every holding in the portfolio source with the given `id`, and the portfolio total, when the source belongs to the caller.',
        '',
        'Each holding value is `amount × currentPrice`, where `currentPrice` is the last price the synchroniser stored for the asset. Values are computed with exact decimal arithmetic and returned as decimal strings — nothing is coerced through a JavaScript float.',
        '',
        'The total is the sum of every valued holding. When a holding has no usable price its `value` is `null`, it is excluded from the total, and the overall `status` becomes `PARTIAL` (some priced) or `UNAVAILABLE` (none priced). An empty portfolio is reported as `EMPTY`.',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    portfolioIdParam(),
    ApiSuccessResponse({
      status: 200,
      description: 'The computed valuation of the portfolio source.',
      type: PortfolioValuationResponseDto
    }),
    ApiErrorResponses(PATH.VALUATION, [
      unauthorizedResponse(),
      notFoundResponse(
        'No portfolio source with this identifier belongs to the caller. Sources owned by another account are reported the same way, so ownership cannot be probed.',
        portfolioNotFound()
      ),
      validationResponse('The `id` is not a UUID.', [
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiCreateHolding = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'createHolding',
      summary: 'Add a holding to a portfolio source',
      description: [
        'Records `amount` of one asset in one of the caller’s portfolio sources. The response embeds the full asset, so adding a holding is enough to render it.',
        '',
        '`portfolioId` must name a source owned by the caller and `assetId` a known asset — both are validated before anything is written. One holding per (portfolio, asset): re-adding the same asset returns `422 HOLDING_ALREADY_EXISTS`; update the existing holding instead.',
        '',
        '`amount` is sent as a decimal string (at most 18 fractional digits) so the value is never coerced through a JavaScript float, and is echoed back unchanged.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiRequestBody(CreateHoldingRequestDto, [
      {
        summary: 'Hold Bitcoin in the Ledger',
        value: {
          portfolioId: ExampleValue.PORTFOLIO_ID,
          assetId: ExampleValue.ASSET_ID,
          amount: '0.500000000000000000',
          notes: 'Cold storage'
        }
      }
    ]),
    ApiSuccessResponse({
      status: 201,
      description:
        'The holding was created and is returned with its asset resolved.',
      type: HoldingResponseDto
    }),
    ApiErrorResponses(PATH.HOLDINGS, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'The portfolio source or the asset does not exist. A source owned by another account is reported the same way, so ownership cannot be probed.',
        portfolioNotFound(),
        assetNotFound()
      ),
      validationResponse(
        'The body failed validation, or the same asset is already held in this source.',
        [
          validationError(
            'amount',
            'amount must be a positive decimal number with at most 18 fractional digits'
          ),
          validationError('portfolioId', 'portfolioId must be a UUID'),
          validationError('assetId', 'assetId must be a UUID'),
          holdingConflict()
        ]
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiListHoldings = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listHoldings',
      summary: 'List the holdings of the authenticated account',
      description: [
        'Returns the caller’s holdings in creation order. Each entry carries its asset resolved inline, so listing holdings does not require follow-up calls to `GET /v1/assets`.',
        '',
        'Pass `portfolioId` to restrict the result to one source. A portfolio owned by another account simply matches nothing.',
        '',
        'The response is shaped like a cursor page (`items` plus `nextCursor`) so a cursor can be added without breaking clients; today the full list is returned and `nextCursor` is always `null`.',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiExtraModels(HoldingResponseDto),
    ApiSuccessResponse({
      status: 200,
      description: 'Every holding owned by the caller (optionally filtered).',
      type: HoldingListResponseDto
    }),
    ApiErrorResponses(PATH.HOLDINGS, [
      unauthorizedResponse(),
      validationResponse('The `portfolioId` query parameter is not a UUID.', [
        validationError('portfolioId', 'portfolioId must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiUpdateHolding = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'updateHolding',
      summary: 'Update a holding',
      description: [
        'Partially updates a holding the caller owns. Every field is optional but the body may not be empty — `{}` is rejected with `422 HOLDING_EMPTY_UPDATE`.',
        '',
        '`portfolioId` and `assetId` cannot be changed; move the holding by deleting it and creating a new one.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    holdingIdParam(),
    ApiRequestBody(UpdateHoldingRequestDto, [
      {
        summary: 'Adjust the amount',
        value: { amount: '0.750000000000000000' }
      },
      {
        summary: 'Replace the note',
        value: { notes: 'Rebalanced' }
      }
    ]),
    ApiSuccessResponse({
      status: 200,
      description: 'The updated holding, re-read after the write.',
      type: HoldingResponseDto
    }),
    ApiErrorResponses(PATH.HOLDING, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'No holding with this identifier belongs to the caller. Holdings owned by another account are reported the same way, so ownership cannot be probed.',
        holdingNotFound()
      ),
      validationResponse(
        'The body was empty or malformed, or the `id` is not a UUID.',
        [
          emptyUpdate(),
          validationError(
            'amount',
            'amount must be a positive decimal number with at most 18 fractional digits'
          ),
          validationError('id', 'id must be a UUID')
        ]
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiDeleteHolding = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'deleteHolding',
      summary: 'Delete a holding',
      description: [
        'Removes a holding the caller owns. The record is deleted, not soft-marked; holdings of the same asset can be re-added afterwards.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    holdingIdParam(),
    ApiNoContent({
      description: 'The holding is deleted. No body is returned.'
    }),
    ApiErrorResponses(PATH.HOLDING, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'No holding with this identifier belongs to the caller, or the `id` is not a UUID.',
        holdingNotFound()
      ),
      validationResponse('The `id` is not a UUID.', [
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );
