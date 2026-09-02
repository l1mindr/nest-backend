import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { HttpStatus } from '@nestjs/common';
import { PortfolioErrorCode } from './portfolio-error-code.enum';

export class PortfolioErrors {
  static portfolioNotFound(portfolioId?: string) {
    return new AppError(
      PortfolioErrorCode.PORTFOLIO_NOT_FOUND,
      ErrorDomain.PORTFOLIO,
      HttpStatus.NOT_FOUND,
      portfolioId ? { portfolioId } : undefined,
      'Portfolio not found'
    );
  }

  static assetNotFound(assetId?: string) {
    return new AppError(
      PortfolioErrorCode.PORTFOLIO_ASSET_NOT_FOUND,
      ErrorDomain.PORTFOLIO,
      HttpStatus.NOT_FOUND,
      assetId ? { assetId } : undefined,
      'Asset not found'
    );
  }

  static holdingNotFound(holdingId?: string) {
    return new AppError(
      PortfolioErrorCode.HOLDING_NOT_FOUND,
      ErrorDomain.PORTFOLIO,
      HttpStatus.NOT_FOUND,
      holdingId ? { holdingId } : undefined,
      'Holding not found'
    );
  }

  static holdingAlreadyExists() {
    return new AppError(
      PortfolioErrorCode.HOLDING_ALREADY_EXISTS,
      ErrorDomain.PORTFOLIO,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { field: 'assetId' },
      'Holding already exists for this asset in this portfolio'
    );
  }

  static holdingEmptyUpdate() {
    return new AppError(
      PortfolioErrorCode.HOLDING_EMPTY_UPDATE,
      ErrorDomain.PORTFOLIO,
      HttpStatus.UNPROCESSABLE_ENTITY,
      undefined,
      'At least one holding field must be provided'
    );
  }

  static portfolioEmptyUpdate() {
    return new AppError(
      PortfolioErrorCode.PORTFOLIO_EMPTY_UPDATE,
      ErrorDomain.PORTFOLIO,
      HttpStatus.UNPROCESSABLE_ENTITY,
      undefined,
      'At least one portfolio field must be provided'
    );
  }

  static transactionNotFound(transactionId?: string) {
    return new AppError(
      PortfolioErrorCode.TRANSACTION_NOT_FOUND,
      ErrorDomain.PORTFOLIO,
      HttpStatus.NOT_FOUND,
      transactionId ? { transactionId } : undefined,
      'Transaction not found'
    );
  }

  static transactionEmptyUpdate() {
    return new AppError(
      PortfolioErrorCode.TRANSACTION_EMPTY_UPDATE,
      ErrorDomain.PORTFOLIO,
      HttpStatus.UNPROCESSABLE_ENTITY,
      undefined,
      'At least one transaction field must be provided'
    );
  }

  static transactionTypeNotSupported() {
    return new AppError(
      PortfolioErrorCode.TRANSACTION_TYPE_NOT_SUPPORTED,
      ErrorDomain.PORTFOLIO,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { field: 'type' },
      'DEPOSIT and WITHDRAWAL transactions are not supported yet'
    );
  }

  static transactionPriceRequired() {
    return new AppError(
      PortfolioErrorCode.TRANSACTION_PRICE_REQUIRED,
      ErrorDomain.PORTFOLIO,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { field: 'price' },
      'BUY and SELL transactions require a price'
    );
  }

  static invalidCursor() {
    return new AppError(
      PortfolioErrorCode.INVALID_CURSOR,
      ErrorDomain.PORTFOLIO,
      HttpStatus.BAD_REQUEST,
      { field: 'cursor' },
      'Invalid cursor'
    );
  }

  static insufficientHoldings(
    assetId?: string,
    currentHolding?: string,
    requestedAmount?: string
  ) {
    return new AppError(
      PortfolioErrorCode.INSUFFICIENT_HOLDINGS,
      ErrorDomain.PORTFOLIO,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { assetId, currentHolding, requestedAmount },
      'Insufficient holdings for this transaction'
    );
  }

  static assetNotFoundError(assetId?: string) {
    return new AppError(
      PortfolioErrorCode.ASSET_NOT_FOUND,
      ErrorDomain.PORTFOLIO,
      HttpStatus.NOT_FOUND,
      assetId ? { assetId } : undefined,
      'Asset not found'
    );
  }
}
