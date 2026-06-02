import { AppError } from '@core/common/errors/app.error';
import { ErrorDomain } from '@core/common/errors/error-domain.enum';
import { HttpStatus } from '@nestjs/common';
import { UserErrorCode } from './user-error-code.enum';

export class UserErrors {
  static userNotFound(userId?: string) {
    return new AppError(
      UserErrorCode.USER_NOT_FOUND,
      ErrorDomain.USER,
      HttpStatus.NOT_FOUND,
      userId ? { userId } : undefined,
      'User not found'
    );
  }

  static emailAlreadyExists() {
    return new AppError(
      UserErrorCode.EMAIL_ALREADY_EXISTS,
      ErrorDomain.USER,
      HttpStatus.UNPROCESSABLE_ENTITY,
      {
        field: 'email'
      },
      'Email already exists'
    );
  }

  static usernameAlreadyExists() {
    return new AppError(
      UserErrorCode.USERNAME_ALREADY_EXISTS,
      ErrorDomain.USER,
      HttpStatus.UNPROCESSABLE_ENTITY,
      {
        field: 'username'
      },
      'Username already exists'
    );
  }
}
