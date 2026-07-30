import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
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

  static invalidCursor() {
    return new AppError(
      UserErrorCode.INVALID_CURSOR,
      ErrorDomain.USER,
      HttpStatus.BAD_REQUEST,
      { field: 'cursor' },
      'Invalid cursor'
    );
  }

  static invalidVerificationCode() {
    return new AppError(
      UserErrorCode.INVALID_VERIFICATION_CODE,
      ErrorDomain.USER,
      HttpStatus.BAD_REQUEST,
      { field: 'code' },
      'Invalid verification code'
    );
  }

  static expiredVerificationCode() {
    return new AppError(
      UserErrorCode.EXPIRED_VERIFICATION_CODE,
      ErrorDomain.USER,
      HttpStatus.BAD_REQUEST,
      { field: 'code' },
      'Verification code has expired'
    );
  }

  static alreadyVerified() {
    return new AppError(
      UserErrorCode.ALREADY_VERIFIED,
      ErrorDomain.USER,
      HttpStatus.CONFLICT,
      undefined,
      'Account is already verified'
    );
  }

  static userAlreadySuspended() {
    return new AppError(
      UserErrorCode.USER_ALREADY_SUSPENDED,
      ErrorDomain.USER,
      HttpStatus.CONFLICT,
      undefined,
      'User is already suspended'
    );
  }

  static invalidStatusTransition(currentStatus: string, targetStatus: string) {
    return new AppError(
      UserErrorCode.INVALID_STATUS_TRANSITION,
      ErrorDomain.USER,
      HttpStatus.CONFLICT,
      { currentStatus, targetStatus },
      `Cannot transition from ${currentStatus} to ${targetStatus}`
    );
  }
}
