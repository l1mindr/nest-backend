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
import { CreatePortfolioTransactionRequestDto } from '../dto/request/create-portfolio-transaction.request.dto';
import { SetPortfolioOpeningBalanceRequestDto } from '../dto/request/set-portfolio-opening-balance.request.dto';
import { UpdateHoldingRequestDto } from '../dto/request/update-holding.request.dto';
import { UpdatePortfolioRequestDto } from '../dto/request/update-portfolio.request.dto';
import { UpdatePortfolioTransactionRequestDto } from '../dto/request/update-portfolio-transaction.request.dto';
import { HoldingListResponseDto } from '../dto/response/holding-list.response.dto';
import { HoldingResponseDto } from '../dto/response/holding.response.dto';
import { PortfolioResponseDto } from '../dto/response/portfolio.response.dto';
import { PortfolioTransactionListResponseDto } from '../dto/response/portfolio-transaction-list.response.dto';
import { PortfolioTransactionResponseDto } from '../dto/response/portfolio-transaction.response.dto';
import { PortfolioValuationResponseDto } from '../dto/response/portfolio-valuation.response.dto';
import { PortfolioPnlResponseDto } from '../dto/response/portfolio-pnl.response.dto';
import { PortfolioPnlPositionResponseDto } from '../dto/response/portfolio-pnl-position.response.dto';
import { PortfolioOpeningBalanceListResponseDto } from '../dto/response/portfolio-opening-balance-list.response.dto';
import { PortfolioOpeningBalanceResponseDto } from '../dto/response/portfolio-opening-balance.response.dto';
import { RealizedPnlEventResponseDto } from '../dto/response/realized-pnl-event.response.dto';

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
  VALUATION: `/v1/portfolios/${ExampleValue.PORTFOLIO_ID}/valuation`,
  PNL: `/v1/portfolios/${ExampleValue.PORTFOLIO_ID}/pnl`,
  OPENING_BALANCES: `/v1/portfolios/${ExampleValue.PORTFOLIO_ID}/opening-balances`,
  OPENING_BALANCE: `/v1/portfolios/${ExampleValue.PORTFOLIO_ID}/opening-balances/${ExampleValue.ASSET_ID}`,
  TRANSACTIONS: `/v1/portfolios/${ExampleValue.PORTFOLIO_ID}/transactions`,
  TRANSACTION: `/v1/portfolios/${ExampleValue.PORTFOLIO_ID}/transactions/${ExampleValue.HOLDING_ID}`
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

const portfolioEmptyUpdate = () =>
  errorExample(
    PortfolioErrors.portfolioEmptyUpdate(),
    'The body contained no updatable field'
  );

const transactionNotFound = () =>
  errorExample(
    PortfolioErrors.transactionNotFound(ExampleValue.HOLDING_ID),
    'No such transaction, or it belongs to another account'
  );

const transactionTypeNotSupported = () =>
  errorExample(
    PortfolioErrors.transactionTypeNotSupported(),
    'DEPOSIT and WITHDRAWAL are reserved for a future cash model'
  );

const transactionPriceRequired = () =>
  errorExample(
    PortfolioErrors.transactionPriceRequired(),
    'BUY and SELL transactions must record the price at the time of the trade'
  );

const transactionEmptyUpdate = () =>
  errorExample(
    PortfolioErrors.transactionEmptyUpdate(),
    'The body contained no updatable field'
  );

const invalidTransactionCursor = () =>
  errorExample(
    PortfolioErrors.invalidCursor(),
    'The cursor is not a base64url JSON object with a valid ISO instant and a UUID'
  );

/** The `:portfolioId` route parameter of the transaction endpoints. */
const transactionPortfolioIdParam = () =>
  ApiParam({
    name: 'portfolioId',
    description:
      'Identifier of the portfolio source, as returned in `id` by `GET /v1/portfolios`.',
    format: 'uuid',
    example: ExampleValue.PORTFOLIO_ID,
    required: true
  });

const openingBalanceAssetIdParam = () =>
  ApiParam({
    name: 'assetId',
    description: 'Identifier of the asset whose opening balance is being set.',
    format: 'uuid',
    example: ExampleValue.ASSET_ID,
    required: true
  });

/** The `:id` route parameter of the single-transaction endpoints. */
const transactionIdParam = () =>
  ApiParam({
    name: 'id',
    description:
      'Identifier of the transaction, as returned in `id` by `GET /v1/portfolios/:portfolioId/transactions`.',
    format: 'uuid',
    example: ExampleValue.HOLDING_ID,
    required: true
  });

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

export const ApiUpdatePortfolio = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'updatePortfolio',
      summary: 'Update a portfolio source by id',
      description: [
        'Updates the portfolio source with the given `id` when it belongs to the caller. At least one field (`name`, `sourceType`, or `walletAddress`) must be provided.',
        '',
        'Pass `null` for `walletAddress` to clear it.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    portfolioIdParam(),
    ApiRequestBody(UpdatePortfolioRequestDto, [
      {
        summary: 'Update the name',
        value: { name: 'My Updated Ledger' }
      },
      {
        summary: 'Change source type and clear wallet address',
        value: { sourceType: 'EXCHANGE', walletAddress: null }
      }
    ]),
    ApiSuccessResponse({
      status: 200,
      description: 'The portfolio source was updated and is returned in full.',
      type: PortfolioResponseDto
    }),
    ApiErrorResponses(PATH.PORTFOLIOS, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'No portfolio source with this identifier belongs to the caller. Sources owned by another account are reported the same way, so ownership cannot be probed.',
        portfolioNotFound()
      ),
      {
        status: 422,
        description: 'The body contained no updatable field.',
        examples: [portfolioEmptyUpdate()]
      },
      validationResponse('The body failed validation.', [
        validationError('id', 'id must be a UUID'),
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

export const ApiDeletePortfolio = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'deletePortfolio',
      summary: 'Delete a portfolio source by id',
      description: [
        'Deletes the portfolio source with the given `id` when it belongs to the caller.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    portfolioIdParam(),
    ApiNoContent({
      description: 'The portfolio source was deleted.'
    }),
    ApiErrorResponses(PATH.PORTFOLIOS, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
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

export const ApiGetPortfolioPnl = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'getPortfolioPnl',
      summary: 'Compute the current P&L of a portfolio source by id',
      description: [
        'Computes the current P&L of every asset traded in the portfolio source with the given `id`, and the portfolio totals, when the source belongs to the caller.',
        '',
        'The calculation starts each asset from its persisted opening quantity and acquisition cost, then replays the recorded transaction ledger through the portfolio calculation engine once per asset. The `costBasis` strategy releases acquisition cost on disposal (`AVERAGE` by default). Everything is computed on demand with exact decimal arithmetic and returned as decimal strings — nothing is coerced through a JavaScript float, and calculated P&L is not persisted or cached.',
        '',
        'The only market-price input is `asset.currentPrice`, the last price the synchroniser stored. The endpoint never calls a price provider. When an asset has no price, its `currentPrice`, `currentValue`, `unrealizedPnl` and `totalPnl` are `null` (never `0`), and `totalCurrentValue`, `totalUnrealizedPnl` and `totalPnl` become `null` while `totalRealizedPnl` stays available. `pricedPositions`/`unpricedPositions` explain the totals.',
        '',
        'Realized P&L is reported gross of fees: a SELL records `proceeds` and a separate `fee`, and the fee is never subtracted from `proceeds` or `realizedPnl`. `TRANSFER_IN` carries zero cost basis and never realizes P&L; `TRANSFER_OUT` releases basis but does not realize P&L; only `SELL` creates a realized P&L event.',
        '',
        'All monetary values are in the portfolio currency (`USD`).',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiExtraModels(
      PortfolioPnlResponseDto,
      PortfolioPnlPositionResponseDto,
      RealizedPnlEventResponseDto
    ),
    ApiSuccessResponse({
      status: 200,
      description: 'The computed P&L of the portfolio source.',
      type: PortfolioPnlResponseDto
    }),
    ApiErrorResponses(PATH.PNL, [
      unauthorizedResponse(),
      notFoundResponse(
        'No portfolio source with this identifier belongs to the caller. Sources owned by another account are reported the same way, so ownership cannot be probed.',
        portfolioNotFound()
      ),
      validationResponse(
        'The `portfolioId` is not a UUID, or `costBasis` is not a supported strategy.',
        [
          validationError('portfolioId', 'portfolioId must be a UUID'),
          validationError(
            'costBasis',
            'costBasis must be one of the following values: AVERAGE, FIFO, LIFO'
          )
        ]
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiSetPortfolioOpeningBalance = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'setPortfolioOpeningBalance',
      summary: 'Set the opening balance for one portfolio asset',
      description: [
        'Creates or replaces the opening state used before the recorded transaction ledger for one asset in a portfolio source.',
        '',
        '`openingQuantity` and `openingCost` are persisted as exact non-negative decimal strings and passed directly to the portfolio calculation engine. This endpoint does not fetch market prices or create a synthetic transaction.',
        '',
        'One opening balance is stored per `(portfolioId, assetId)`. Repeating the request updates the same record.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    transactionPortfolioIdParam(),
    openingBalanceAssetIdParam(),
    ApiRequestBody(SetPortfolioOpeningBalanceRequestDto, [
      {
        summary: 'Set a Bitcoin opening position',
        value: {
          openingQuantity: '1.5',
          openingCost: '90000'
        }
      }
    ]),
    ApiSuccessResponse({
      status: 200,
      description:
        'The opening balance was stored and is returned with its asset resolved.',
      type: PortfolioOpeningBalanceResponseDto
    }),
    ApiErrorResponses(PATH.OPENING_BALANCE, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'The portfolio source or asset does not exist. A source owned by another account is reported the same way, so ownership cannot be probed.',
        portfolioNotFound(),
        assetNotFound()
      ),
      validationResponse('A path parameter or decimal field is invalid.', [
        validationError('portfolioId', 'portfolioId must be a UUID'),
        validationError('assetId', 'assetId must be a UUID'),
        validationError(
          'openingQuantity',
          'must be a non-negative decimal number with at most 18 fractional digits'
        ),
        validationError(
          'openingCost',
          'must be a non-negative decimal number with at most 26 fractional digits'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiListPortfolioOpeningBalances = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listPortfolioOpeningBalances',
      summary: 'List the opening balances of a portfolio source',
      description: [
        'Returns the persisted per-asset opening states that are applied before the portfolio transaction ledger.',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    transactionPortfolioIdParam(),
    ApiSuccessResponse({
      status: 200,
      description: 'Every opening balance stored for the portfolio source.',
      type: PortfolioOpeningBalanceListResponseDto
    }),
    ApiErrorResponses(PATH.OPENING_BALANCES, [
      unauthorizedResponse(),
      notFoundResponse(
        'No portfolio source with this identifier belongs to the caller. Sources owned by another account are reported the same way, so ownership cannot be probed.',
        portfolioNotFound()
      ),
      validationResponse('The `portfolioId` is not a UUID.', [
        validationError('portfolioId', 'portfolioId must be a UUID')
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
            'must be a positive decimal number with at most 18 fractional digits'
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
            'must be a positive decimal number with at most 18 fractional digits'
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

export const ApiCreatePortfolioTransaction = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'createPortfolioTransaction',
      summary: 'Record a transaction in a portfolio source',
      description: [
        'Appends a transaction to the ledger of one of the caller’s portfolio sources. A transaction is a historical event — `occurredAt`, `amount` and `price` are stored exactly as supplied and never rewritten from a live price.',
        '',
        '`BUY` and `SELL` record the `price` per unit at the time of the trade and require it. `TRANSFER_IN` and `TRANSFER_OUT` move assets between sources and take an optional `price`. `DEPOSIT` and `WITHDRAWAL` are reserved for a future cash model and are rejected for now.',
        '',
        '`portfolioId` must name a source owned by the caller and `assetId` a known asset — both are validated before anything is written. Recorded transactions are historical input, not live positions: nothing is added to or subtracted from the `amount` of a holding, which remains the manually recorded position.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    transactionPortfolioIdParam(),
    ApiRequestBody(CreatePortfolioTransactionRequestDto, [
      {
        summary: 'Buy Bitcoin at a recorded price',
        value: {
          assetId: ExampleValue.ASSET_ID,
          type: 'BUY',
          amount: '0.5',
          price: '60000.50',
          fee: '0.75',
          occurredAt: ExampleValue.TIMESTAMP,
          notes: 'Dollar-cost average'
        }
      },
      {
        summary: 'Transfer out to another source',
        value: {
          assetId: ExampleValue.ASSET_ID,
          type: 'TRANSFER_OUT',
          amount: '0.25',
          occurredAt: ExampleValue.TIMESTAMP
        }
      }
    ]),
    ApiSuccessResponse({
      status: 201,
      description:
        'The transaction was recorded and is returned with its asset resolved.',
      type: PortfolioTransactionResponseDto
    }),
    ApiErrorResponses(PATH.TRANSACTIONS, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'The portfolio source or the asset does not exist. A source owned by another account is reported the same way, so ownership cannot be probed.',
        portfolioNotFound(),
        assetNotFound()
      ),
      validationResponse(
        'The body failed validation, or the transaction type is not recordable.',
        [
          validationError(
            'amount',
            'must be a positive decimal number with at most 18 fractional digits'
          ),
          validationError(
            'price',
            'must be a positive decimal number with at most 8 fractional digits'
          ),
          validationError(
            'fee',
            'must be a non-negative decimal number with at most 8 fractional digits'
          ),
          validationError(
            'occurredAt',
            'occurredAt must be a valid ISO 8601 date string'
          ),
          validationError('portfolioId', 'portfolioId must be a UUID'),
          validationError('assetId', 'assetId must be a UUID'),
          validationError(
            'type',
            'type must be one of the following values: BUY, SELL, TRANSFER_IN, TRANSFER_OUT, DEPOSIT, WITHDRAWAL'
          ),
          transactionTypeNotSupported(),
          transactionPriceRequired()
        ]
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiListPortfolioTransactions = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listPortfolioTransactions',
      summary: 'List the transactions of a portfolio source',
      description: [
        'Returns the transactions recorded against one of the caller’s portfolio sources, newest first (`occurredAt` descending, then `id` for ties). Each entry carries its asset resolved inline.',
        '',
        'Results are forward-paginated with an opaque cursor: omit `cursor` for the first page and copy the `nextCursor` of every response verbatim into the next request until it is `null`. Filters (`assetId`, `type`, `from`, `to`) narrow the window before pagination.',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    transactionPortfolioIdParam(),
    ApiExtraModels(PortfolioTransactionListResponseDto),
    ApiSuccessResponse({
      status: 200,
      description: 'A page of transactions recorded against the source.',
      type: PortfolioTransactionListResponseDto
    }),
    ApiErrorResponses(PATH.TRANSACTIONS, [
      unauthorizedResponse(),
      badRequestResponse(
        'The `cursor` query parameter was not produced by this endpoint.',
        invalidTransactionCursor()
      ),
      notFoundResponse(
        'No portfolio source with this identifier belongs to the caller. Sources owned by another account are reported the same way, so ownership cannot be probed.',
        portfolioNotFound()
      ),
      validationResponse('A query parameter failed validation.', [
        validationError('portfolioId', 'portfolioId must be a UUID'),
        validationError('assetId', 'assetId must be a UUID'),
        validationError(
          'type',
          'type must be one of the following values: BUY, SELL, TRANSFER_IN, TRANSFER_OUT, DEPOSIT, WITHDRAWAL'
        ),
        validationError('from', 'from must be a valid ISO 8601 date string'),
        validationError('to', 'to must be a valid ISO 8601 date string')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiGetPortfolioTransaction = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'getPortfolioTransaction',
      summary: 'Get a portfolio transaction by id',
      description: [
        'Returns the transaction with the given `id` when it belongs to one of the caller’s portfolio sources. The `price` is the value recorded at creation time, never a live price.',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    transactionPortfolioIdParam(),
    transactionIdParam(),
    ApiSuccessResponse({
      status: 200,
      description: 'The transaction owned by the caller.',
      type: PortfolioTransactionResponseDto
    }),
    ApiErrorResponses(PATH.TRANSACTION, [
      unauthorizedResponse(),
      notFoundResponse(
        'No transaction with this identifier belongs to the caller, or the portfolio source does not exist. Both are reported the same way, so ownership cannot be probed.',
        portfolioNotFound(),
        transactionNotFound()
      ),
      validationResponse('The `id` or `portfolioId` is not a UUID.', [
        validationError('portfolioId', 'portfolioId must be a UUID'),
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiUpdatePortfolioTransaction = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'updatePortfolioTransaction',
      summary: 'Update a transaction by id',
      description: [
        'Updates the transaction with the given `id` in the portfolio source with the given `portfolioId`, when both belong to the caller. At least one field must be provided.',
        '',
        'The transaction type, amount, price, fee, instant, and notes can all be updated. Pass `null` for optional fields to clear them.',
        '',
        'When changing `type` or `price`, the business rules are re-checked: `BUY` and `SELL` require a `price`, and `DEPOSIT`/`WITHDRAWAL` are rejected. After the update, on-demand P&L calculations will naturally reflect the updated transaction.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    transactionPortfolioIdParam(),
    transactionIdParam(),
    ApiRequestBody(UpdatePortfolioTransactionRequestDto, [
      {
        summary: 'Update the amount and price',
        value: { amount: '1.0', price: '65000' }
      },
      {
        summary: 'Change type from BUY to TRANSFER_IN and clear price',
        value: { type: 'TRANSFER_IN', price: null }
      }
    ]),
    ApiSuccessResponse({
      status: 200,
      description:
        'The transaction was updated and is returned with its asset resolved.',
      type: PortfolioTransactionResponseDto
    }),
    ApiErrorResponses(PATH.TRANSACTION, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'The portfolio source or transaction does not exist, or either belongs to another account.',
        portfolioNotFound(),
        transactionNotFound()
      ),
      {
        status: 422,
        description:
          'The body contained no updatable field, or the updated combination violates a business rule.',
        examples: [
          transactionEmptyUpdate(),
          transactionTypeNotSupported(),
          transactionPriceRequired()
        ]
      },
      validationResponse('The body failed validation.', [
        validationError('portfolioId', 'portfolioId must be a UUID'),
        validationError('id', 'id must be a UUID'),
        validationError(
          'type',
          'type must be one of the following values: BUY, SELL, TRANSFER_IN, TRANSFER_OUT, DEPOSIT, WITHDRAWAL'
        ),
        validationError('amount', 'amount must be a valid decimal string'),
        validationError(
          'price',
          'price must be a decimal string with at most 8 fractional digits'
        ),
        validationError(
          'fee',
          'fee must be a non-negative decimal string with at most 8 fractional digits'
        ),
        validationError(
          'occurredAt',
          'occurredAt must be a valid ISO 8601 date string'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiDeletePortfolioTransaction = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'deletePortfolioTransaction',
      summary: 'Delete a portfolio transaction',
      description: [
        'Removes a transaction the caller recorded. Deleting is the documented way to correct a mistaken ledger entry; the row is removed, not soft-marked.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    transactionPortfolioIdParam(),
    transactionIdParam(),
    ApiNoContent({
      description: 'The transaction is deleted. No body is returned.'
    }),
    ApiErrorResponses(PATH.TRANSACTION, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'No transaction with this identifier belongs to the caller, or the portfolio source does not exist. Both are reported the same way, so ownership cannot be probed.',
        portfolioNotFound(),
        transactionNotFound()
      ),
      validationResponse('The `id` or `portfolioId` is not a UUID.', [
        validationError('portfolioId', 'portfolioId must be a UUID'),
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );
