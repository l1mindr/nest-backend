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

  static coingeckoApiError(detail?: string) {
    return new AppError(
      AssetErrorCode.COINGECKO_API_ERROR,
      ErrorDomain.ASSETS,
      HttpStatus.BAD_GATEWAY,
      detail ? { detail } : undefined,
      'Failed to fetch data from CoinGecko'
    );
  }

  static emptySync() {
    return new AppError(
      AssetErrorCode.ASSET_SYNC_EMPTY_RESPONSE,
      ErrorDomain.ASSETS,
      HttpStatus.BAD_GATEWAY,
      undefined,
      'No valid assets in CoinGecko response'
    );
  }
}
