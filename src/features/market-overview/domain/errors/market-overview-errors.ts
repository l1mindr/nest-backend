import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { HttpStatus } from '@nestjs/common';
import { MarketOverviewErrorCode } from './market-overview-error-code.enum';

export class MarketOverviewErrors {
  static providerRateLimited() {
    return new AppError(
      MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_RATE_LIMITED,
      ErrorDomain.MARKET_OVERVIEW,
      HttpStatus.TOO_MANY_REQUESTS,
      undefined,
      'Global market data provider rate limit reached'
    );
  }

  static providerTimeout() {
    return new AppError(
      MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_TIMEOUT,
      ErrorDomain.MARKET_OVERVIEW,
      HttpStatus.GATEWAY_TIMEOUT,
      undefined,
      'Global market data provider request timed out'
    );
  }

  static providerUnavailable() {
    return new AppError(
      MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_UNAVAILABLE,
      ErrorDomain.MARKET_OVERVIEW,
      HttpStatus.BAD_GATEWAY,
      undefined,
      'Global market data provider is unavailable'
    );
  }

  static providerBadRequest() {
    return new AppError(
      MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_BAD_REQUEST,
      ErrorDomain.MARKET_OVERVIEW,
      HttpStatus.BAD_GATEWAY,
      undefined,
      'Global market data provider rejected the request'
    );
  }

  static providerInvalidResponse() {
    return new AppError(
      MarketOverviewErrorCode.MARKET_OVERVIEW_PROVIDER_INVALID_RESPONSE,
      ErrorDomain.MARKET_OVERVIEW,
      HttpStatus.BAD_GATEWAY,
      undefined,
      'Global market data provider returned an invalid response'
    );
  }
}
