import { AppError } from '@core/common/errors/app.error';
import { ErrorDomain } from '@core/common/errors/error-domain.enum';
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

  static sessionReuseDetected(sessionId?: string) {
    return new AppError(
      SessionErrorCode.SESSION_REUSE_DETECTED,
      ErrorDomain.SESSION,
      HttpStatus.UNAUTHORIZED,
      sessionId ? { sessionId } : undefined,
      'Session reuse detected'
    );
  }
}
