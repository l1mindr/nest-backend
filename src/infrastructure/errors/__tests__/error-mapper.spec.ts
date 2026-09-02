import { HttpException, HttpStatus } from '@nestjs/common';
import { AppError } from '@core/errors/app.error';
import { DomainErrorCode } from '@core/errors/domain-error-code.enum';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { CalculationError } from '@features/portfolio/domain/calculation/errors/calculation-errors';
import { CalculationErrorCode } from '@features/portfolio/domain/calculation/errors/calculation-error-code.enum';
import { ErrorMapper } from '../error-mapper';

describe('ErrorMapper', () => {
  it('passes through an existing AppError', () => {
    const appError = new AppError(
      'SOME_CODE',
      ErrorDomain.PORTFOLIO,
      HttpStatus.NOT_FOUND,
      undefined,
      'message'
    );
    expect(ErrorMapper.from(appError)).toBe(appError);
  });

  it('maps an HttpException to an AppError preserving status', () => {
    const exception = new HttpException('not allowed', HttpStatus.FORBIDDEN);
    const mapped = ErrorMapper.from(exception);
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped.statusCode).toBe(HttpStatus.FORBIDDEN);
    expect(mapped.code).toBe(DomainErrorCode.HTTP_EXCEPTION);
  });

  it('maps a CalculationError to a 422 VALIDATION_ERROR with code and field', () => {
    const error = new CalculationError(
      CalculationErrorCode.INSUFFICIENT_QUANTITY,
      'amount',
      'Transaction amount exceeds the available quantity'
    );
    const mapped = ErrorMapper.from(error);
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mapped.code).toBe(DomainErrorCode.VALIDATION);
    expect(mapped.domain).toBe(ErrorDomain.PORTFOLIO);
    expect(mapped.metadata).toEqual({
      code: CalculationErrorCode.INSUFFICIENT_QUANTITY,
      field: 'amount'
    });
    expect(mapped.message).toBe(
      'Transaction amount exceeds the available quantity'
    );
  });

  it('maps an unknown raw error to INTERNAL_ERROR/500', () => {
    const mapped = ErrorMapper.from(new Error('boom'));
    expect(mapped.code).toBe(DomainErrorCode.INTERNAL_ERROR);
    expect(mapped.domain).toBe(ErrorDomain.SYSTEM);
    expect(mapped.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
