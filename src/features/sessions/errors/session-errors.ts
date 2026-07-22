import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { HttpStatus } from '@nestjs/common';
import { SessionErrorCode } from './session-error-code.enum';

export class SessionErrors {
  static sessionNotFound(sessionId?: string) {
    return new AppError(
      SessionErrorCode.SESSION_NOT_FOUND,
      ErrorDomain.SESSION,
      HttpStatus.NOT_FOUND,
      sessionId ? { sessionId } : undefined,
      'Session not found'
    );
  }

  static sessionExpired(sessionId?: string) {
    return new AppError(
      SessionErrorCode.SESSION_EXPIRED,
      ErrorDomain.SESSION,
      HttpStatus.UNAUTHORIZED,
      sessionId ? { sessionId } : undefined,
      'Session expired'
    );
  }

  static sessionRevoked(sessionId?: string) {
    return new AppError(
      SessionErrorCode.SESSION_REVOKED,
      ErrorDomain.SESSION,
      HttpStatus.UNAUTHORIZED,
      sessionId ? { sessionId } : undefined,
      'Session revoked'
    );
  }

  static refreshRateLimited(sessionId?: string) {
    return new AppError(
      SessionErrorCode.REFRESH_RATE_LIMITED,

      ErrorDomain.SESSION,

      HttpStatus.TOO_MANY_REQUESTS,

      sessionId ? { sessionId } : undefined,

      'Refresh token request is too frequent'
    );
  }

  static sessionReuseDetected(sessionId?: string) {
    return new AppError(
      SessionErrorCode.SESSION_REUSE_DETECTED,
      ErrorDomain.SESSION,
      HttpStatus.UNAUTHORIZED,
      sessionId ? { sessionId } : undefined,
      'Session reuse detected'
    );
  }

  static invalidCursor() {
    return new AppError(
      SessionErrorCode.INVALID_CURSOR,
      ErrorDomain.SESSION,
      HttpStatus.BAD_REQUEST,
      { field: 'cursor' },
      'Invalid cursor'
    );
  }
}
