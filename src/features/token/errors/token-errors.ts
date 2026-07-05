import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { HttpStatus } from '@nestjs/common';
import { TokenErrorCode } from './token-error-code.enum';

export class TokenErrors {
  static invalidToken() {
    return new AppError(
      TokenErrorCode.INVALID_TOKEN,
      ErrorDomain.TOKEN,
      HttpStatus.UNAUTHORIZED,
      undefined,
      'Invalid token'
    );
  }

  static expiredToken() {
    return new AppError(
      TokenErrorCode.EXPIRED_TOKEN,
      ErrorDomain.TOKEN,
      HttpStatus.UNAUTHORIZED,
      undefined,
      'Token expired'
    );
  }

  static invalidRefreshToken() {
    return new AppError(
      TokenErrorCode.INVALID_REFRESH_TOKEN,
      ErrorDomain.TOKEN,
      HttpStatus.UNAUTHORIZED,
      undefined,
      'Invalid refresh token'
    );
  }
}
