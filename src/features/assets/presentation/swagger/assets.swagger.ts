import { SecurityErrors } from '@features/security/errors/security-errors';
import {
  CommonErrors,
  badRequestResponse,
  forbiddenResponse,
  internalServerErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationError,
  validationResponse
} from '@presentation/swagger/api-error.catalog';
import {
  ApiErrorResponseOptions,
  ApiErrorResponses,
  ApiSuccessResponse,
  errorExample
} from '@presentation/swagger/api-response.decorator';
import {
  ApiAuthenticated,
  ApiCsrfProtected
} from '@presentation/swagger/api-security.decorator';
import { ExampleValue } from '@presentation/swagger/openapi.constants';
import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProperty } from '@nestjs/swagger';
import { AssetErrors } from '../../domain/errors/asset-errors';
import { ASSETS_PAGE_SIZE_MAX } from '../dto/request/asset-list.request.dto';
import { AssetListResponseDto } from '../dto/response/asset-list.response.dto';
import { AssetResponseDto } from '../dto/response/asset.response.dto';

/**
 * Operation documentation for `AssetsController` and `AssetSyncController`.
 *
 * Reading the catalogue only requires authentication. Synchronising it is the
 * exception: it rewrites the catalogue from CoinGecko, so it is restricted to
 * the owner and additionally demands a valid `x-csrf-token` header.
 */

/** Result of a completed CoinGecko synchronisation run. */
class SyncAssetsResponseDto {
  @ApiProperty({
    description:
      'Number of assets CoinGecko reported for the market range being synchronised.',
    example: 2500
  })
  receivedCount!: number;

  @ApiProperty({
    description:
      'Number of assets that were persisted after normalisation (raw records that failed validation are excluded).',
    example: 2498
  })
  synchronizedCount!: number;
}

const PATH = {
  ASSETS: '/v1/assets',
  ASSET: `/v1/assets/${ExampleValue.ASSET_ID}`,
  SYNC: '/v1/assets/sync'
} as const;

/** The `:id` route parameter of the single-asset endpoint. */
const assetIdParam = () =>
  ApiParam({
    name: 'id',
    description:
      'Identifier of the asset, as returned in `id` by `GET /v1/assets`.',
    format: 'uuid',
    example: ExampleValue.ASSET_ID,
    required: true
  });

const assetNotFound = () =>
  errorExample(
    AssetErrors.assetNotFound(ExampleValue.ASSET_ID),
    'No asset carries this identifier'
  );

const invalidCursor = () =>
  errorExample(
    AssetErrors.invalidCursor(),
    'Cursor is not valid base64url, or does not decode to an asset identifier this endpoint issued'
  );

const ownerOnlyForbidden = (): ApiErrorResponseOptions =>
  forbiddenResponse(
    'The request was authenticated but rejected: the caller is not the owner, or the CSRF check failed.',
    errorExample(
      SecurityErrors.accessDenied(),
      'The caller holds neither `OWNER` nor a rank that satisfies it'
    ),
    CommonErrors.invalidCsrfToken
  );

const coingeckoUnavailable = (): ApiErrorResponseOptions => ({
  status: HttpStatus.BAD_GATEWAY,
  description:
    'The synchronisation run could not be completed because CoinGecko was unreachable or returned nothing usable.',
  examples: [
    errorExample(
      AssetErrors.coingeckoApiError(),
      'The CoinGecko request failed or timed out'
    ),
    errorExample(
      AssetErrors.emptySync(),
      'CoinGecko responded, but no record survived validation'
    )
  ]
});

export const ApiListAssets = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listAssets',
      summary: 'List supported assets',
      description: [
        'Lists the assets synchronised from CoinGecko. An asset describes the currency itself — the thing a portfolio eventually holds — not a user’s holding, so the catalogue is shared rather than account-scoped.',
        '',
        `Pass \`search\` to match a case-insensitive substring against the symbol and name. Cursor-paginated, up to ${ASSETS_PAGE_SIZE_MAX} per page.`,
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiSuccessResponse({
      status: 200,
      description:
        'One page of assets, ordered by identifier. `nextCursor` is `null` on the last page.',
      type: AssetListResponseDto
    }),
    ApiErrorResponses(PATH.ASSETS, [
      badRequestResponse(
        'The `cursor` query parameter was not produced by this endpoint.',
        invalidCursor()
      ),
      unauthorizedResponse(),
      validationResponse('A pagination or search parameter is out of range.', [
        validationError(
          'limit',
          `limit must not be greater than ${ASSETS_PAGE_SIZE_MAX}`
        ),
        validationError(
          'search',
          `search must be longer than or equal to 1 characters`
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiGetAsset = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'getAsset',
      summary: 'Get an asset by ID',
      description: [
        'Returns the asset with the given identifier, including its latest synchronised market data. An unknown identifier is reported as `404`.',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    assetIdParam(),
    ApiSuccessResponse({
      status: 200,
      description: 'The requested asset and its market data.',
      type: AssetResponseDto
    }),
    ApiErrorResponses(PATH.ASSET, [
      unauthorizedResponse(),
      notFoundResponse('No asset carries this identifier.', assetNotFound()),
      validationResponse('The `id` is not a UUID.', [
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiSyncAssets = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'syncAssets',
      summary: 'Sync assets from CoinGecko',
      description: [
        'Fetches the current CoinGecko market range and upserts the asset catalogue from it. Running it replaces the market snapshot with what CoinGecko reports now; assets that CoinGecko no longer returns are left untouched rather than deleted.',
        '',
        'Restricted to the owner: rewriting the shared catalogue from an external source is not something an administrator is allowed to trigger. Requires authentication, the `OWNER` role and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiSuccessResponse({
      status: 200,
      description:
        'The run completed. `receivedCount` counts the raw records CoinGecko returned, `synchronizedCount` how many were persisted after validation.',
      type: SyncAssetsResponseDto
    }),
    ApiErrorResponses(PATH.SYNC, [
      unauthorizedResponse(),
      ownerOnlyForbidden(),
      coingeckoUnavailable(),
      internalServerErrorResponse()
    ])
  );
