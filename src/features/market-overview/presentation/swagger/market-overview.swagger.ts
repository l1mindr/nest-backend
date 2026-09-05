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
import { MarketOverviewResponseDto } from '../dto/response/market-overview.response.dto';

/** Operation documentation for `MarketOverviewController`. */

const PATH = '/v1/market/overview';

export const ApiGetMarketOverview = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'getMarketOverview',
      summary: 'Get the total crypto market snapshot',
      description: [
        'Returns the total market capitalisation across all tracked cryptocurrencies, its 24h change and Bitcoin dominance, as reported by CoinGecko.',
        '',
        'The response may be served from a short-lived server-side cache; `updatedAt` reflects when the provider computed the snapshot, not when this request ran. If the provider is briefly unavailable, a still-cached value is served instead of failing the request; only a request with no cached value at all can fail.',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiSuccessResponse({
      status: 200,
      description: 'The current global market snapshot.',
      type: MarketOverviewResponseDto
    }),
    ApiErrorResponses(PATH, [
      unauthorizedResponse(),
      rateLimitResponse(
        'The market data provider rate limit was reached and no cached value was available.',
        errorExample(
          MarketOverviewErrors.providerRateLimited(),
          'CoinGecko rejected the request with 429'
        )
      ),
      badGatewayResponse(
        'The market data provider is unavailable, rejected the request, or returned a response this API could not parse, and no cached value was available.',
        errorExample(
          MarketOverviewErrors.providerUnavailable(),
          'CoinGecko is unreachable or returned a 5xx'
        ),
        errorExample(
          MarketOverviewErrors.providerBadRequest(),
          'CoinGecko rejected the request with an unexpected 4xx'
        ),
        errorExample(
          MarketOverviewErrors.providerInvalidResponse(),
          'CoinGecko returned a body missing the expected fields'
        )
      ),
      gatewayTimeoutResponse(
        'The market data provider did not respond in time and no cached value was available.',
        errorExample(
          MarketOverviewErrors.providerTimeout(),
          'CoinGecko did not respond within the configured timeout'
        )
      ),
      internalServerErrorResponse()
    ])
  );
