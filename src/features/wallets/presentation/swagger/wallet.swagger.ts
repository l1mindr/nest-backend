import {
  csrfForbiddenResponse,
  internalServerErrorResponse,
  unauthorizedResponse,
  validationError,
  validationResponse
} from '@presentation/swagger/api-error.catalog';
import {
  ApiErrorResponses,
  ApiSuccessResponse
} from '@presentation/swagger/api-response.decorator';
import {
  ApiAuthenticated,
  ApiCsrfProtected
} from '@presentation/swagger/api-security.decorator';
import { ApiRequestBody } from '@presentation/swagger/api-request.decorator';
import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  getSchemaPath
} from '@nestjs/swagger';
import { CreateWalletRequestDto } from '../dto/request/create-wallet.request.dto';
import { WalletResponseDto } from '../dto/response/wallet.response.dto';

/**
 * Operation documentation for `WalletsController`.
 *
 * A wallet is a transfer destination the caller can register and reuse
 * across transactions; every wallet is scoped to the authenticated user.
 */

const PATH = {
  WALLETS: '/v1/wallets'
};

export const ApiCreateWallet = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'createWallet',
      summary: 'Register a wallet',
      description: [
        'Registers a wallet the caller can select as a transfer destination. `name` is required; `address` is optional.',
        '',
        'Requires authentication and a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiRequestBody(CreateWalletRequestDto, [
      {
        summary: 'Register a wallet with a known address',
        value: { name: 'MetaMask', address: '0x1234...' }
      },
      {
        summary: 'Register a wallet by name only',
        value: { name: 'Ledger' }
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
