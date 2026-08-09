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
}
