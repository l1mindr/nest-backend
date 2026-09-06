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
import { MarketSentimentErrors } from '../../domain/errors/market-sentiment-errors';
import { FearGreedResponseDto } from '../dto/response/fear-greed.response.dto';

/** Operation documentation for `MarketSentimentController`. */

const PATH = '/v1/market/fear-greed';

export const ApiGetFearGreed = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'getFearGreed',
      summary: 'Get the current Fear & Greed Index',
      description: [
        'Returns the current crypto market Fear & Greed Index value and classification, as reported by alternative.me.',
        '',
        'The response may be served from a short-lived server-side cache, since the index itself only changes roughly once a day upstream; `updatedAt` reflects when the provider published the value, not when this request ran. If the provider is briefly unavailable, a still-cached value is served instead of failing the request; only a request with no cached value at all can fail.',
        '',
        'Requires authentication.'
      ].join('\n')
    }),
    ApiAuthenticated(),
    ApiSuccessResponse({
      status: 200,
      description: 'The current Fear & Greed Index snapshot.',
      type: FearGreedResponseDto
    }),
    ApiErrorResponses(PATH, [
      unauthorizedResponse(),
      rateLimitResponse(
        'The Fear & Greed provider rate limit was reached and no cached value was available.',
        errorExample(
          MarketSentimentErrors.providerRateLimited(),
          'alternative.me rejected the request with 429'
        )
      ),
      badGatewayResponse(
        'The Fear & Greed provider is unavailable, rejected the request, or returned a response this API could not parse, and no cached value was available.',
        errorExample(
          MarketSentimentErrors.providerUnavailable(),
          'alternative.me is unreachable or returned a 5xx'
        ),
        errorExample(
          MarketSentimentErrors.providerBadRequest(),
          'alternative.me rejected the request with an unexpected 4xx'
        ),
        errorExample(
          MarketSentimentErrors.providerInvalidResponse(),
          'alternative.me returned a body missing the expected fields'
        )
      ),
      gatewayTimeoutResponse(
        'The Fear & Greed provider did not respond in time and no cached value was available.',
        errorExample(
          MarketSentimentErrors.providerTimeout(),
          'alternative.me did not respond within the configured timeout'
        )
      ),
      internalServerErrorResponse()
    ])
  );
