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

  /**
   * The caller asked to revoke the session they are currently using, by id.
   *
   * That is a logout, and `DELETE /v1/sessions` is the route for it — it
   * carries `ClearAuthCookiesInterceptor`, so it also clears the auth cookies.
   * Revoking the same session through this route would leave the browser
   * presenting credentials the server has already invalidated, which is a
   * worse state than refusing.
   */
  static sessionIsCurrent(sessionId?: string) {
    return new AppError(
      SessionErrorCode.SESSION_IS_CURRENT,
      ErrorDomain.SESSION,
      HttpStatus.CONFLICT,
      sessionId ? { sessionId } : undefined,
      'Use DELETE /v1/sessions to end the current session'
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
