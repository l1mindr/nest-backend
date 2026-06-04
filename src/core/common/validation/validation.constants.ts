import { HttpStatus, ValidationPipeOptions } from '@nestjs/common';
import { AppError } from '../errors/app.error';
import { DomainErrorCode } from '../errors/domain-error-code.enum';
import { ErrorDomain } from '../errors/error-domain.enum';

export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true
  },
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  exceptionFactory: (errors) => {
    const firstError = errors[0];
    const firstConstraint = firstError?.constraints
      ? Object.values(firstError.constraints)[0]
      : 'Validation error';

    return new AppError(
      DomainErrorCode.VALIDATION,
      ErrorDomain.VALIDATION,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { field: firstError.property },
      firstConstraint
    );
  }
};
