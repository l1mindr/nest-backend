import { HttpException, HttpStatus } from '@nestjs/common';
import { AppError } from '@core/errors/app.error';
import { DomainErrorCode } from '@core/errors/domain-error-code.enum';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { CalculationError } from '@features/portfolio/domain/calculation/errors/calculation-errors';

export class ErrorMapper {
  static from(error: unknown): AppError {
    if (error instanceof AppError) return error;

    if (error instanceof CalculationError) {
      return new AppError(
        DomainErrorCode.VALIDATION,
        ErrorDomain.PORTFOLIO,
        HttpStatus.UNPROCESSABLE_ENTITY,
        { code: error.code, field: error.field },
        error.message
      );
    }

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
