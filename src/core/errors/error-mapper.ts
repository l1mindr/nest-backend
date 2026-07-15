import { HttpException, HttpStatus } from '@nestjs/common';
import { AppError } from './app.error';
import { DomainErrorCode } from './domain-error-code.enum';
import { ErrorDomain } from './error-domain.enum';

export class ErrorMapper {
  static from(error: unknown): AppError {
    if (error instanceof AppError) return error;

    if (error instanceof HttpException) {
      const status = error.getStatus();
      const response = error.getResponse();

      const responseObj =
        typeof response === 'object' && response !== null
          ? (response as Record<string, unknown>)
          : undefined;

      const message =
        typeof response === 'string'
          ? response
          : responseObj?.message != null
            ? String(responseObj.message)
            : 'HTTP Error';

      return new AppError(
        DomainErrorCode.HTTP_EXCEPTION,
        ErrorDomain.HTTP,
        status,
        responseObj?.errors as Record<string, unknown> | undefined,
        message
      );
    }

    return new AppError(
      DomainErrorCode.INTERNAL_ERROR,
      ErrorDomain.SYSTEM,
      HttpStatus.INTERNAL_SERVER_ERROR,
      undefined,
      'Unexpected error'
    );
  }
}
