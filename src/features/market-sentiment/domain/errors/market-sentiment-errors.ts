import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { HttpStatus } from '@nestjs/common';
import { MarketSentimentErrorCode } from './market-sentiment-error-code.enum';

export class MarketSentimentErrors {
  static providerRateLimited() {
    return new AppError(
      MarketSentimentErrorCode.MARKET_SENTIMENT_PROVIDER_RATE_LIMITED,
      ErrorDomain.MARKET_SENTIMENT,
      HttpStatus.TOO_MANY_REQUESTS,
      undefined,
      'Fear & Greed provider rate limit reached'
    );
  }

  static providerTimeout() {
    return new AppError(
      MarketSentimentErrorCode.MARKET_SENTIMENT_PROVIDER_TIMEOUT,
      ErrorDomain.MARKET_SENTIMENT,
      HttpStatus.GATEWAY_TIMEOUT,
      undefined,
      'Fear & Greed provider request timed out'
    );
  }

  static providerUnavailable() {
    return new AppError(
      MarketSentimentErrorCode.MARKET_SENTIMENT_PROVIDER_UNAVAILABLE,
      ErrorDomain.MARKET_SENTIMENT,
      HttpStatus.BAD_GATEWAY,
      undefined,
      'Fear & Greed provider is unavailable'
    );
  }

  static providerBadRequest() {
    return new AppError(
      MarketSentimentErrorCode.MARKET_SENTIMENT_PROVIDER_BAD_REQUEST,
      ErrorDomain.MARKET_SENTIMENT,
      HttpStatus.BAD_GATEWAY,
      undefined,
      'Fear & Greed provider rejected the request'
    );
  }

  static providerInvalidResponse() {
    return new AppError(
      MarketSentimentErrorCode.MARKET_SENTIMENT_PROVIDER_INVALID_RESPONSE,
      ErrorDomain.MARKET_SENTIMENT,
      HttpStatus.BAD_GATEWAY,
      undefined,
      'Fear & Greed provider returned an invalid response'
    );
  }
}
