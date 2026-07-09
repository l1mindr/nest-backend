import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { HttpStatus } from '@nestjs/common';
import { SecurityErrorCode } from './security-error-code.enum';

export class SecurityErrors {
  static authenticationRequired() {
    return new AppError(
      SecurityErrorCode.AUTHENTICATION_REQUIRED,
      ErrorDomain.SECURITY,
      HttpStatus.UNAUTHORIZED,
      undefined,
      'Authentication required'
    );
  }

  static accessDenied() {
    return new AppError(
      SecurityErrorCode.ACCESS_DENIED,
      ErrorDomain.SECURITY,
      HttpStatus.FORBIDDEN,
      undefined,
      'Access denied'
    );
  }

  static rateLimitExceeded() {
    return new AppError(
      SecurityErrorCode.RATE_LIMIT_EXCEEDED,
      ErrorDomain.SECURITY,
      HttpStatus.TOO_MANY_REQUESTS,
      undefined,
      'Too many requests. Please try again later.'
    );
  }
}
