import { AppError } from '@core/errors/app.error';
import { ErrorDomain } from '@core/errors/error-domain.enum';
import { SessionErrors } from '@features/sessions/domain/errors/session-errors';
import { TokenErrors } from '@features/token/errors/token-errors';
import { CallHandler, ExecutionContext, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { of, throwError } from 'rxjs';
import {
  AUTH_COOKIE_NAMES,
  tokenCookieOptions,
  REFRESH_TOKEN_COOKIE_MAX_AGE_MS
} from '../../../application/services/auth-cookie.constants';
import { ClearRefreshCookieInterceptor } from '../clear-refresh-cookie.interceptor';

/**
 * A refresh that fails because the token is finished must take the cookie with
 * it; one that fails because the server could not tell must not. These tests
 * pin both halves, and the attribute parity that decides whether the browser
 * actually removes the cookie or quietly keeps the original.
 */

type CookieCall = { name: string; options: Record<string, unknown> };

function captureResponse(): { res: Response; cleared: CookieCall[] } {
  const cleared: CookieCall[] = [];
  const res = {
    clearCookie: (name: string, options: Record<string, unknown>) => {
      cleared.push({ name, options });
      return res;
    }
  } as unknown as Response;

  return { res, cleared };
}

function run(res: Response, handler: CallHandler) {
  const context = {
    switchToHttp: () => ({ getResponse: () => res })
  } as unknown as ExecutionContext;

  return new Promise<{ error?: unknown }>((resolve) => {
    new ClearRefreshCookieInterceptor().intercept(context, handler).subscribe({
      complete: () => resolve({}),
      error: (error: unknown) => resolve({ error })
    });
  });
}

const failingWith = (error: unknown): CallHandler => ({
  handle: () => throwError(() => error)
});

describe('ClearRefreshCookieInterceptor', () => {
  describe('failures that prove the token is finished', () => {
    it.each([
      [
        'INVALID_TOKEN — tampered or wrongly signed',
        TokenErrors.invalidToken()
      ],
      ['EXPIRED_TOKEN', TokenErrors.expiredToken()],
      ['INVALID_REFRESH_TOKEN', TokenErrors.invalidRefreshToken()],
      [
        'SESSION_EXPIRED — also covers a revoked session',
        SessionErrors.sessionExpired()
      ],
      ['SESSION_REVOKED', SessionErrors.sessionRevoked()],
      ['SESSION_REUSE_DETECTED — replay', SessionErrors.sessionReuseDetected()]
    ])('clears refresh_token on %s', async (_label, error) => {
      const { res, cleared } = captureResponse();

      await run(res, failingWith(error));

      expect(cleared.map((call) => call.name)).toEqual([
        AUTH_COOKIE_NAMES.REFRESH_TOKEN
      ]);
    });

    it('re-throws the original error untouched, so the status and code are unchanged', async () => {
      const { res } = captureResponse();
      const thrown = SessionErrors.sessionReuseDetected('session-1');

      const { error } = await run(res, failingWith(thrown));

      expect(error).toBe(thrown);
      expect((error as AppError).statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect((error as AppError).code).toBe('SESSION_REUSE_DETECTED');
    });

    /**
     * The whole fix is inert if these drift: a browser matches a deleting
     * `Set-Cookie` against an existing cookie by name plus these attributes,
     * and a mismatch creates a second cookie while the live one survives.
     */
    it('deletes with the identity attributes the cookie was written with', async () => {
      const { res, cleared } = captureResponse();

      await run(res, failingWith(TokenErrors.invalidToken()));

      const written = tokenCookieOptions(REFRESH_TOKEN_COOKIE_MAX_AGE_MS);
      const { options } = cleared[0];

      for (const key of ['domain', 'path', 'secure', 'sameSite'] as const) {
        expect(options[key]).toEqual(written[key]);
      }

      // HttpOnly is not an identity attribute, but dropping it on the delete
      // would be a needless downgrade of the header we emit.
      expect(options.httpOnly).toBe(true);
      // `res.clearCookie` supplies the epoch expiry; a maxAge here would be
      // stripped anyway, but passing one at all reads like a re-issue.
      expect(options.maxAge).toBeUndefined();
    });

    it('honours COOKIE_DOMAIN, so a domain-scoped cookie is actually removable', async () => {
      const original = process.env.COOKIE_DOMAIN;
      process.env.COOKIE_DOMAIN = '.localtest.me';

      try {
        const { res, cleared } = captureResponse();

        await run(res, failingWith(SessionErrors.sessionExpired()));

        expect(cleared[0].options.domain).toBe('.localtest.me');
      } finally {
        if (original === undefined) {
          delete process.env.COOKIE_DOMAIN;
        } else {
          process.env.COOKIE_DOMAIN = original;
        }
      }
    });
  });

  describe('failures that say nothing about the token', () => {
    it('keeps the cookie on REFRESH_RATE_LIMITED, so a legitimate retry still has a credential', async () => {
      const { res, cleared } = captureResponse();

      const { error } = await run(
        res,
        failingWith(SessionErrors.refreshRateLimited('session-1'))
      );

      expect(cleared).toEqual([]);
      expect((error as AppError).statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('keeps the cookie on REFRESH_ROTATION_CONFLICT, which is the credential the retry needs', async () => {
      const { res, cleared } = captureResponse();

      const { error } = await run(
        res,
        failingWith(SessionErrors.refreshRotationConflict('session-1'))
      );

      // The token matched the stored hash; another request simply committed
      // first. Clearing here would turn a retryable conflict into the logout
      // this interceptor's allowlist exists to avoid.
      expect(cleared).toEqual([]);
      expect((error as AppError).statusCode).toBe(HttpStatus.CONFLICT);
      expect((error as AppError).code).toBe('REFRESH_ROTATION_CONFLICT');
    });

    it('keeps the cookie when the infrastructure fails', async () => {
      const { res, cleared } = captureResponse();

      // What Redis or Postgres being unreachable looks like here: a throw the
      // use case never classified, which ErrorMapper turns into a 500.
      await run(res, failingWith(new Error('ECONNREFUSED')));

      expect(cleared).toEqual([]);
    });

    it('keeps the cookie for an unrecognised AppError', async () => {
      const { res, cleared } = captureResponse();

      await run(
        res,
        failingWith(
          new AppError(
            'SOMETHING_NEW',
            ErrorDomain.SESSION,
            HttpStatus.UNAUTHORIZED,
            undefined,
            'A failure mode added later'
          )
        )
      );

      // Allowlist, not denylist: a new 401 has to opt in on purpose.
      expect(cleared).toEqual([]);
    });
  });

  it('touches no cookie on a successful refresh', async () => {
    const { res, cleared } = captureResponse();

    await run(res, { handle: () => of(undefined) });

    // Rotation is AuthCookieInterceptor's job; a stray clear here would race
    // it and delete the pair it just issued.
    expect(cleared).toEqual([]);
  });
});
