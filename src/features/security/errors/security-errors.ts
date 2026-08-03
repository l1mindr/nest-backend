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

  /**
   * The retry hint is optional so existing zero-argument call sites keep
   * working. When supplied it surfaces as `meta.retryAfter` in the body and as
   * the `Retry-After` header, set by the global exception filter.
   *
   * Deliberately carries nothing about which policy or identifier tripped: that
   * detail belongs in the logs, not in a response an attacker can read.
   */
  static rateLimitExceeded(retryAfterSeconds?: number) {
    return new AppError(
      SecurityErrorCode.RATE_LIMIT_EXCEEDED,
      ErrorDomain.SECURITY,
      HttpStatus.TOO_MANY_REQUESTS,
      retryAfterSeconds && retryAfterSeconds > 0
        ? { retryAfter: retryAfterSeconds }
        : undefined,
      'Too many requests. Please try again later.'
    );
  }

  static invalidCsrfToken() {
    return new AppError(
      SecurityErrorCode.INVALID_CSRF_TOKEN,
      ErrorDomain.SECURITY,
      HttpStatus.FORBIDDEN,
      undefined,
      'Invalid CSRF token.'
    );
  }
}
