import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { HttpStatus } from '@nestjs/common';
import { CoinTrackerErrorCode } from './coin-tracker-error-code.enum';

export class CoinTrackerErrors {
  static coinNotFound(coinId?: string) {
    return new AppError(
      CoinTrackerErrorCode.COIN_NOT_FOUND,
      ErrorDomain.COIN_TRACKER,
      HttpStatus.NOT_FOUND,
      coinId ? { coinId } : undefined,
      'Coin not found'
    );
  }

  static priceAlertNotFound(alertId?: string) {
    return new AppError(
      CoinTrackerErrorCode.PRICE_ALERT_NOT_FOUND,
      ErrorDomain.COIN_TRACKER,
      HttpStatus.NOT_FOUND,
      alertId ? { alertId } : undefined,
      'Price alert not found'
    );
  }

  static priceAlertExpired(alertId: string) {
    return new AppError(
      CoinTrackerErrorCode.PRICE_ALERT_EXPIRED,
      ErrorDomain.COIN_TRACKER,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { alertId },
      'Price alert has expired'
    );
  }

  static priceAlertCancelled(alertId: string) {
    return new AppError(
      CoinTrackerErrorCode.PRICE_ALERT_CANCELLED,
      ErrorDomain.COIN_TRACKER,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { alertId },
      'Price alert has been cancelled'
    );
  }

  static priceAlertTriggered(alertId: string) {
    return new AppError(
      CoinTrackerErrorCode.PRICE_ALERT_TRIGGERED,
      ErrorDomain.COIN_TRACKER,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { alertId },
      'Triggered price alert cannot be updated'
    );
  }

  static invalidExpiration() {
    return new AppError(
      CoinTrackerErrorCode.INVALID_EXPIRATION,
      ErrorDomain.COIN_TRACKER,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { field: 'expiresAt' },
      'Expiration date must be in the future'
    );
  }

  static emptyUpdate() {
    return new AppError(
      CoinTrackerErrorCode.EMPTY_UPDATE,
      ErrorDomain.COIN_TRACKER,
      HttpStatus.UNPROCESSABLE_ENTITY,
      undefined,
      'At least one price alert field must be provided'
    );
  }

  static invalidCursor() {
    return new AppError(
      CoinTrackerErrorCode.INVALID_CURSOR,
      ErrorDomain.COIN_TRACKER,
      HttpStatus.BAD_REQUEST,
      { field: 'cursor' },
      'Invalid cursor'
    );
  }

  static coingeckoApiError(detail?: string) {
    return new AppError(
      CoinTrackerErrorCode.COINGECKO_API_ERROR,
      ErrorDomain.COIN_TRACKER,
      HttpStatus.BAD_GATEWAY,
      detail ? { detail } : undefined,
      'Failed to fetch data from CoinGecko'
    );
  }
}
