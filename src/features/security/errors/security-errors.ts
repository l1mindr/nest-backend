import { AppError } from '@core/common/errors/app.error';
import { ErrorDomain } from '@core/common/errors/error-domain.enum';
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
}
