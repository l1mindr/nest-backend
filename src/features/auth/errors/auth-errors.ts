import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { HttpStatus } from '@nestjs/common';
import { AuthErrorCode } from './auth-error-code.enum';

export class AuthErrors {
  static invalidCredentials() {
    return new AppError(
      AuthErrorCode.INVALID_CREDENTIALS,
      ErrorDomain.AUTH,
      HttpStatus.UNAUTHORIZED,
      undefined,
      'Invalid credentials'
    );
  }

  static invalidCurrentPassword() {
    return new AppError(
      AuthErrorCode.INVALID_CURRENT_PASSWORD,
      ErrorDomain.AUTH,
      HttpStatus.BAD_REQUEST,
      { field: 'currentPassword' },
      'Invalid current password'
    );
  }

  static passwordMustBeDifferent() {
    return new AppError(
      AuthErrorCode.PASSWORD_MUST_BE_DIFFERENT,
      ErrorDomain.AUTH,
      HttpStatus.BAD_REQUEST,
      {
        field: 'newPassword'
      },
      'New password must be different'
    );
  }
}
