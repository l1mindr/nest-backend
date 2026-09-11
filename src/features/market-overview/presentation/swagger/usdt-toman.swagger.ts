import {
  badGatewayResponse,
  gatewayTimeoutResponse,
  internalServerErrorResponse,
  rateLimitResponse,
  unauthorizedResponse
} from '@presentation/swagger/api-error.catalog';
import {
  ApiErrorResponses,
  ApiSuccessResponse,
  errorExample
} from '@presentation/swagger/api-response.decorator';
import { ApiAuthenticated } from '@presentation/swagger/api-security.decorator';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { MarketOverviewErrors } from '../../domain/errors/market-overview-errors';
import { UsdtTomanResponseDto } from '../dto/response/usdt-toman.response.dto';

/** Operation documentation for `UsdtTomanController`. */

const PATH = '/v1/market/usdt-toman';

export const ApiGetUsdtToman = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'getUsdtTomanRate',
      summary: 'Get the live USDT price in Iranian Toman',
      description: [
        'Returns the current USDT price in Iranian **Toman**, read from an Iranian exchange. CoinGecko does not quote Iranian currency, so this route has its own upstreams and its own cache.',
        '',
        'Two exchanges back this route — Nobitex and Wallex. `USDT_TOMAN_PROVIDER` picks the preferred one; if it is unavailable the other is tried automatically, and the `provider` field reports which actually answered.',
        '',
        'The value is Toman, not Rial, whichever exchange served it. Nobitex prices its market in Rial and is divided by `RIAL_PER_TOMAN` (default 10), configurable so the assumption can be corrected without a code change; Wallex quotes Toman already and is passed through unscaled.',
        '',
        'The response may be served from a short-lived server-side cache. If *every* exchange is unavailable, a still-cached value is served instead of failing the request — flagged with `isStale: true` and its original `fetchedAt`, never presented as a fresh read. Only a request with no cached value at all can fail.',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiSuccessResponse({
      status: 200,
      description: 'The current USDT/Toman rate.',
      type: UsdtTomanResponseDto
    }),
    ApiErrorResponses(PATH, [
      unauthorizedResponse(),
      rateLimitResponse(
        'The market data provider rate limit was reached and no cached value was available.',
        errorExample(
          MarketOverviewErrors.providerRateLimited(),
          'The exchange rejected the request with 429'
        )
      ),
      badGatewayResponse(
        'Every configured exchange is unavailable, rejected the request, or returned a response this API could not parse, and no cached value was available.',
        errorExample(
          MarketOverviewErrors.providersExhausted(['nobitex', 'wallex']),
          'Both the preferred exchange and its fallback failed'
        ),
        errorExample(
          MarketOverviewErrors.providerUnavailable(),
          'The exchange is unreachable or returned a 5xx'
        ),
        errorExample(
          MarketOverviewErrors.providerBadRequest(),
          'The exchange rejected the request with an unexpected 4xx'
        ),
        errorExample(
          MarketOverviewErrors.providerInvalidResponse(),
          'The exchange returned a body missing the expected fields'
        )
      ),
      gatewayTimeoutResponse(
        'The market data provider did not respond in time and no cached value was available.',
        errorExample(
          MarketOverviewErrors.providerTimeout(),
          'The exchange did not respond within the configured timeout'
        )
      ),
      internalServerErrorResponse()
    ])
  );
