import {
  conflictResponse,
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
import { WalletErrors } from '../../domain/errors/wallet-errors';
import { CreateWalletRequestDto } from '../dto/request/create-wallet.request.dto';
import { UpdateWalletRequestDto } from '../dto/request/update-wallet.request.dto';
import { WalletResponseDto } from '../dto/response/wallet.response.dto';

/**
 * Operation documentation for `WalletsController`.
 *
 * A wallet is a transfer destination the caller can register and reuse
 * across transactions; every wallet is scoped to the authenticated user. A
 * wallet owned by someone else is reported as `404`, never as `403`, so
 * ownership cannot be probed by identifier.
 */

const PATH = {
  WALLETS: '/v1/wallets',
  WALLET: `/v1/wallets/${ExampleValue.WALLET_ID}`
};

/** The `:id` route parameter of the single-wallet endpoints. */
const walletIdParam = () =>
  ApiParam({
    name: 'id',
    description:
      'Identifier of the wallet, as returned in `id` by `GET /v1/wallets`.',
    format: 'uuid',
    example: ExampleValue.WALLET_ID,
    required: true
  });

const walletNotFound = () =>
  errorExample(
    WalletErrors.walletNotFound(ExampleValue.WALLET_ID),
    'No such wallet, or it belongs to another account'
  );

export const ApiCreateWallet = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'createWallet',
      summary: 'Register a wallet',
      description: [
        'Registers a wallet the caller can select as a transfer destination. `name` is required; `addresses` is optional and holds at most one entry per network.',
        '',
        'A wallet is one identity across every chain it holds funds on — register "Ledger X" once with a Solana, Bitcoin and Ethereum address, not three wallets sharing a name.',
        '',
        'Each address is checked against its network’s format (prefix, alphabet, length). Checksums are not verified.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiRequestBody(CreateWalletRequestDto, [
      {
        summary: 'Register a wallet spanning several networks',
        value: {
          name: 'Ledger X',
          addresses: [
            {
              network: 'SOLANA',
              address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
            },
            {
              network: 'BITCOIN',
              address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
            },
            {
              network: 'ETHEREUM',
              address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
            }
          ]
        }
      },
      {
        summary: 'Register a wallet by name only',
        value: { name: 'My Cold Wallet' }
      }
    ]),
    ApiSuccessResponse({
      status: 201,
      description: 'The wallet was registered and is returned in full.',
      type: WalletResponseDto
    }),
    ApiErrorResponses(PATH.WALLETS, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      validationResponse('The body failed validation.', [
        validationError(
          'name',
          'name must be longer than or equal to 1 characters'
        ),
        validationError(
          'addresses',
          'each network may appear only once per wallet'
        ),
        validationError(
          'addresses.0.address',
          'address is not valid for SOLANA: expected a base58 public key of 32 to 44 characters'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiListWallets = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'listWallets',
      summary: 'List the wallets of the authenticated account',
      description: [
        'Returns the caller’s registered wallets in reverse creation order.',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiExtraModels(WalletResponseDto),
    ApiResponse({
      status: 200,
      description: 'Every wallet owned by the caller.',
      schema: {
        type: 'array',
        items: { $ref: getSchemaPath(WalletResponseDto) }
      }
    }),
    ApiErrorResponses(PATH.WALLETS, [
      unauthorizedResponse(),
      internalServerErrorResponse()
    ])
  );

export const ApiUpdateWallet = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'updateWallet',
      summary: 'Update a wallet by id',
      description: [
        'Updates the wallet with the given `id` when it belongs to the caller. At least one field (`name` or `addresses`) must be provided.',
        '',
        '`addresses` **replaces** the stored set: a network left out is removed, a new one is added, and a changed address is updated. Pass `[]` to clear every address, or omit the key to leave them untouched.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    walletIdParam(),
    ApiRequestBody(UpdateWalletRequestDto, [
      {
        summary: 'Rename the wallet, leaving its addresses alone',
        value: { name: 'Ledger Nano S' }
      },
      {
        summary: 'Replace the address set — drops any network not listed',
        value: {
          addresses: [
            {
              network: 'SOLANA',
              address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
            },
            {
              network: 'POLYGON',
              address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
            }
          ]
        }
      },
      {
        summary: 'Clear every address',
        value: { addresses: [] }
      }
    ]),
    ApiSuccessResponse({
      status: 200,
      description: 'The wallet was updated and is returned in full.',
      type: WalletResponseDto
    }),
    ApiErrorResponses(PATH.WALLET, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'No wallet with this identifier belongs to the caller. Wallets owned by another account are reported the same way, so ownership cannot be probed.',
        walletNotFound()
      ),
      {
        status: 422,
        description: 'The body contained no updatable field.',
        examples: [
          errorExample(
            WalletErrors.walletEmptyUpdate(),
            'Neither name nor address was sent'
          )
        ]
      },
      validationResponse('The body failed validation.', [
        validationError('id', 'id must be a UUID'),
        validationError(
          'name',
          'name must be longer than or equal to 1 characters'
        ),
        validationError(
          'addresses',
          'each network may appear only once per wallet'
        ),
        validationError(
          'addresses.0.address',
          'address is not valid for ETHEREUM: expected 0x followed by 40 hexadecimal characters'
        )
      ]),
      internalServerErrorResponse()
    ])
  );

export const ApiDeleteWallet = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'deleteWallet',
      summary: 'Delete a wallet by id',
      description: [
        'Deletes the wallet with the given `id` when it belongs to the caller.',
        '',
        'A wallet named as the transfer destination of at least one transaction is **not** deleted: the request fails with `409 WALLET_IN_USE` and `meta.transactionCount` reports how many transactions still reference it. No transaction is rewritten or removed to make the delete possible — clear the destination on those transactions first.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    walletIdParam(),
    ApiNoContent({
      description: 'The wallet was deleted.'
    }),
    ApiErrorResponses(PATH.WALLET, [
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      notFoundResponse(
        'No wallet with this identifier belongs to the caller. Wallets owned by another account are reported the same way, so ownership cannot be probed.',
        walletNotFound()
      ),
      conflictResponse(
        'The wallet is still referenced by transactions and was left untouched.',
        errorExample(
          WalletErrors.walletInUse(ExampleValue.WALLET_ID, 3),
          'Three transactions still name this wallet'
        )
      ),
      validationResponse('The `id` is not a UUID.', [
        validationError('id', 'id must be a UUID')
      ]),
      internalServerErrorResponse()
    ])
  );
