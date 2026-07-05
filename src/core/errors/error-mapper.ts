import { HttpException, HttpStatus } from '@nestjs/common';
import { AppError } from './app.error';
import { DomainErrorCode } from './domain-error-code.enum';
import { ErrorDomain } from './error-domain.enum';

export class ErrorMapper {
  static from(error: unknown): AppError {
    // Already AppError
    if (error instanceof AppError) return error;

    // Nest HTTP errors
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const response = error.getResponse();

      const message =
        typeof response === 'string'
          ? response
          : ((response as any)?.message ?? 'HTTP Error');

      return new AppError(
        DomainErrorCode.HTTP_EXCEPTION,
        ErrorDomain.HTTP,
        status,
        (response as any)?.errors,
        message
      );
    }

    // Unknown errors
    return new AppError(
      DomainErrorCode.INTERNAL_ERROR,
      ErrorDomain.SYSTEM,
      HttpStatus.INTERNAL_SERVER_ERROR,
      undefined,
      'Unexpected error'
    );
  }
}
