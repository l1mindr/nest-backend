import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { HttpStatus } from '@nestjs/common';
import { AssetErrorCode } from './asset-error-code.enum';

export class AssetErrors {
  static assetNotFound(assetId?: string) {
    return new AppError(
      AssetErrorCode.ASSET_NOT_FOUND,
      ErrorDomain.ASSETS,
      HttpStatus.NOT_FOUND,
      assetId ? { assetId } : undefined,
      'Asset not found'
    );
  }

  static invalidCursor() {
    return new AppError(
      AssetErrorCode.ASSET_INVALID_CURSOR,
      ErrorDomain.ASSETS,
      HttpStatus.BAD_REQUEST,
      { field: 'cursor' },
      'Invalid cursor'
    );
  }

  static emptySync() {
    return new AppError(
      AssetErrorCode.ASSET_SYNC_EMPTY_RESPONSE,
      ErrorDomain.ASSETS,
      HttpStatus.BAD_GATEWAY,
      undefined,
      'No valid assets in market data response'
    );
  }

  static providerRateLimited() {
    return new AppError(
      AssetErrorCode.MARKET_DATA_PROVIDER_RATE_LIMITED,
      ErrorDomain.ASSETS,
      HttpStatus.TOO_MANY_REQUESTS,
      undefined,
      'Market data provider rate limit reached'
    );
  }

  static providerTimeout() {
    return new AppError(
      AssetErrorCode.MARKET_DATA_PROVIDER_TIMEOUT,
      ErrorDomain.ASSETS,
      HttpStatus.GATEWAY_TIMEOUT,
      undefined,
      'Market data provider request timed out'
    );
  }

  static providerUnavailable() {
    return new AppError(
      AssetErrorCode.MARKET_DATA_PROVIDER_UNAVAILABLE,
      ErrorDomain.ASSETS,
      HttpStatus.BAD_GATEWAY,
      undefined,
      'Market data provider is unavailable'
    );
  }

  static providerBadRequest() {
    return new AppError(
      AssetErrorCode.MARKET_DATA_PROVIDER_BAD_REQUEST,
      ErrorDomain.ASSETS,
      HttpStatus.BAD_GATEWAY,
      undefined,
      'Market data provider rejected the request'
    );
  }

  static providerInvalidResponse() {
    return new AppError(
      AssetErrorCode.MARKET_DATA_PROVIDER_INVALID_RESPONSE,
      ErrorDomain.ASSETS,
      HttpStatus.BAD_GATEWAY,
      undefined,
      'Market data provider returned an invalid response'
    );
  }
}
