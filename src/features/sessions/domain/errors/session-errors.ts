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

  /**
   * The optimistic rotation lost a race it was entitled to lose.
   *
   * `Refresh` reads the session, mints a pair, then commits with a
   * compare-and-swap on `(version, refreshTokenHash)`. Zero rows affected means
   * the row moved underneath it — another request rotated the same session
   * between the read and the write. Most realistically the five-second
   * `REFRESH_LOCK` expired while this request was still in flight, so a second
   * one acquired it legitimately.
   *
   * This is emphatically **not** reuse. The token this caller presented matched
   * the stored hash at read time; it was the current token. Answering with
   * `SESSION_REUSE_DETECTED` conflated "you replayed a spent token" with "you
   * were a few milliseconds late", and the frontend — which reads any 401 from
   * refresh as a dead session — logged the user out for it.
   *
   * So: `409`, the status the rest of this codebase already uses for "your
   * request conflicts with the resource's current state" (see
   * {@link sessionIsCurrent}), the session left alone, and the token left in
   * the browser. The winner has already committed a rotation by definition, so
   * a retry finds either the new token or, if this client's cookie has not
   * caught up yet, the winner's pair through the rotation grace window. Either
   * way it resolves without another round of this.
   */
  static refreshRotationConflict(sessionId?: string) {
    return new AppError(
      SessionErrorCode.REFRESH_ROTATION_CONFLICT,
      ErrorDomain.SESSION,
      HttpStatus.CONFLICT,
      sessionId ? { sessionId } : undefined,
      'Refresh token rotation conflict'
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
