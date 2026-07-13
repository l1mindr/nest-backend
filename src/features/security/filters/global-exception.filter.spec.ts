import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { AuthErrors } from '@features/auth/errors/auth-errors';
import { SecurityErrors } from '@features/security/errors/security-errors';
import { SessionErrors } from '@features/sessions/errors/session-errors';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  const json = jest.fn();
  const status = jest.fn(() => ({ json }));

  const req = {
    id: 'correlation-id',
    method: 'POST',
    url: '/v1/auth/login',
    ip: '127.0.0.1'
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => req
    })
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new GlobalExceptionFilter(mockLogger as unknown as PinoLogger);
  });

  it('keeps the existing response format for domain errors', () => {
    filter.catch(AuthErrors.invalidCredentials(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INVALID_CREDENTIALS',
        domain: ErrorDomain.AUTH,
        message: 'Invalid credentials',
        meta: {},
        path: '/v1/auth/login',
        timestamp: expect.any(String)
      }
    });
  });

  it('logs unexpected 5xx errors at error level with the original stack', () => {
    const boom = new Error('kaboom');

    filter.catch(boom, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: LogEvent.UNEXPECTED_EXCEPTION,
        err: boom,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      }),
      'Unexpected exception'
    );
    // Internal details never leak into the response body.
    expect(json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error'
      })
    });
  });

  it('logs refresh-token reuse detection as a high-severity security event', () => {
    filter.catch(SessionErrors.sessionReuseDetected('session-id'), host);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: LogEvent.REFRESH_REUSE_DETECTED,
        sessionId: 'session-id'
      }),
      'Refresh token reuse detected'
    );
  });

  it('logs authentication failures as warnings', () => {
    filter.catch(SecurityErrors.authenticationRequired(), host);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: LogEvent.AUTHENTICATION_FAILED }),
      'Authentication failed'
    );
  });

  it('logs authorization failures as warnings', () => {
    filter.catch(SecurityErrors.accessDenied(), host);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: LogEvent.AUTHORIZATION_FAILED }),
      'Authorization failed'
    );
  });

  it('logs rate-limit violations as warnings', () => {
    filter.catch(SecurityErrors.rateLimitExceeded(), host);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: LogEvent.RATE_LIMIT_EXCEEDED }),
      'Rate limit exceeded'
    );
  });

  it('does not emit security logs for benign client errors', () => {
    filter.catch(
      new AppError('X', ErrorDomain.VALIDATION, HttpStatus.BAD_REQUEST),
      host
    );

    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
