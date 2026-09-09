import { Response } from 'express';
import { of } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { AuthCookieService } from '../auth-cookie.service';
import { ClearAuthCookiesInterceptor } from '../../../presentation/interceptors/clear-auth-cookies.interceptor';
import {
  AUTH_COOKIE_NAMES,
  CSRF_TOKEN_COOKIE_MAX_AGE_MS
} from '../auth-cookie.constants';

/**
 * A browser removes a cookie only when the clearing `Set-Cookie` carries the
 * same `Domain`, `Path`, `Secure` and `SameSite` the cookie was written with.
 * Get any one of them wrong and the delete is treated as a *different* cookie:
 * the original stays, logout silently leaves credentials in the browser, and
 * nothing fails loudly.
 *
 * `AuthCookieService` and `ClearAuthCookiesInterceptor` both build their
 * attributes from `baseAuthCookieOptions()`, so they cannot drift today. This
 * test exists to keep it that way — it compares what the two actually pass to
 * Express rather than trusting that they still share a helper, so splitting
 * them into two hand-maintained copies breaks the build.
 */

/** The attributes that decide cookie identity for a delete. */
const IDENTITY_KEYS = ['domain', 'path', 'secure', 'sameSite'] as const;

type CookieCall = { name: string; options: Record<string, unknown> };

function pickIdentity(options: Record<string, unknown>) {
  return Object.fromEntries(IDENTITY_KEYS.map((key) => [key, options?.[key]]));
}

/** Captures `res.cookie(...)` calls made by the writer. */
function captureWrite(): { res: Response; calls: CookieCall[] } {
  const calls: CookieCall[] = [];
  const res = {
    cookie: (
      name: string,
      _value: string,
      options: Record<string, unknown>
    ) => {
      calls.push({ name, options });
      return res;
    }
  } as unknown as Response;

  return { res, calls };
}

/** Captures `res.clearCookie(...)` calls made by the interceptor. */
function captureClear(): { res: Response; calls: CookieCall[] } {
  const calls: CookieCall[] = [];
  const res = {
    clearCookie: (name: string, options: Record<string, unknown>) => {
      calls.push({ name, options });
      return res;
    }
  } as unknown as Response;

  return { res, calls };
}

function runWriter(res: Response) {
  // The session id is decoded from the access token to mint the CSRF cookie;
  // a token whose payload carries one keeps all three cookies in play.
  const payload = Buffer.from(
    JSON.stringify({ sub: 'user-1', sessionId: 'session-1' })
  ).toString('base64url');
  const accessToken = `header.${payload}.signature`;

  const csrfTokenService = {
    issue: () => 'nonce.123.signature'
  };

  new AuthCookieService(csrfTokenService as never).set(res, {
    accessToken,
    refreshToken: 'refresh-token'
  });
}

async function runClearer(res: Response) {
  const context = {
    switchToHttp: () => ({ getResponse: () => res })
  } as unknown as ExecutionContext;

  const next: CallHandler = { handle: () => of(undefined) };

  await new Promise<void>((resolve, reject) => {
    new ClearAuthCookiesInterceptor()
      .intercept(context, next)
      .subscribe({ complete: resolve, error: reject });
  });
}

describe('auth cookie write/clear parity', () => {
  const originalDomain = process.env.COOKIE_DOMAIN;

  afterEach(() => {
    if (originalDomain === undefined) {
      delete process.env.COOKIE_DOMAIN;
    } else {
      process.env.COOKIE_DOMAIN = originalDomain;
    }
  });

  describe.each([
    ['host-only (COOKIE_DOMAIN unset)', undefined],
    ['domain-scoped (COOKIE_DOMAIN set)', '.localtest.me']
  ])('%s', (_label, cookieDomain) => {
    beforeEach(() => {
      if (cookieDomain === undefined) {
        delete process.env.COOKIE_DOMAIN;
      } else {
        process.env.COOKIE_DOMAIN = cookieDomain;
      }
    });

    it('clears every cookie it writes, with identical identity attributes', async () => {
      const writer = captureWrite();
      runWriter(writer.res);

      const clearer = captureClear();
      await runClearer(clearer.res);

      const written = writer.calls.map((call) => call.name).sort();
      const cleared = clearer.calls.map((call) => call.name).sort();

      // Every cookie the writer sets must be one the clearer removes —
      // otherwise logout leaves a credential behind.
      expect(written).toEqual(
        [
          AUTH_COOKIE_NAMES.ACCESS_TOKEN,
          AUTH_COOKIE_NAMES.REFRESH_TOKEN,
          AUTH_COOKIE_NAMES.CSRF_TOKEN
        ].sort()
      );
      expect(cleared).toEqual(written);

      for (const { name, options } of writer.calls) {
        const clearOptions = clearer.calls.find(
          (call) => call.name === name
        )?.options;

        expect(pickIdentity(clearOptions!)).toEqual(pickIdentity(options));
      }
    });

    it('applies the configured domain to all three cookies, or none of them', async () => {
      const writer = captureWrite();
      runWriter(writer.res);

      const clearer = captureClear();
      await runClearer(clearer.res);

      for (const { options } of [...writer.calls, ...clearer.calls]) {
        expect(options.domain).toBe(cookieDomain);
      }
    });
  });

  it('emits no Domain attribute at all when COOKIE_DOMAIN is unset', () => {
    delete process.env.COOKIE_DOMAIN;

    const writer = captureWrite();
    runWriter(writer.res);

    // `domain: undefined` would still be an own property; Express ignores it,
    // but asserting absence keeps the host-only case unambiguous.
    for (const { options } of writer.calls) {
      expect(Object.prototype.hasOwnProperty.call(options, 'domain')).toBe(
        false
      );
    }
  });

  it('keeps httpOnly on the token cookies and off the CSRF cookie', () => {
    const writer = captureWrite();
    runWriter(writer.res);

    const byName = new Map(
      writer.calls.map((call) => [call.name, call.options])
    );

    expect(byName.get(AUTH_COOKIE_NAMES.ACCESS_TOKEN)?.httpOnly).toBe(true);
    expect(byName.get(AUTH_COOKIE_NAMES.REFRESH_TOKEN)?.httpOnly).toBe(true);
    // Readable by design: the double-submit header is copied from it.
    expect(byName.get(AUTH_COOKIE_NAMES.CSRF_TOKEN)?.httpOnly).toBe(false);
  });

  /**
   * The CSRF cookie used to carry no `maxAge`, making it a session cookie that
   * disappeared on browser close while `refresh_token` survived a week. The
   * reopened browser was authenticated with no CSRF token, so the first unsafe
   * request 403'd and nothing recovered on its own — the client refreshes on
   * 401 only.
   */
  describe('csrf_token lifetime', () => {
    function csrfWriteOptions() {
      const writer = captureWrite();
      runWriter(writer.res);

      return writer.calls.find(
        (call) => call.name === AUTH_COOKIE_NAMES.CSRF_TOKEN
      )!.options;
    }

    it('is persistent for the refresh token’s 7 days, not a session cookie', () => {
      expect(csrfWriteOptions().maxAge).toBe(CSRF_TOKEN_COOKIE_MAX_AGE_MS);
      // 604800 seconds, as the browser will render it.
      expect(csrfWriteOptions().maxAge).toBe(604_800_000);
    });

    it('matches the refresh cookie exactly, so the two cannot drift apart', () => {
      const writer = captureWrite();
      runWriter(writer.res);

      const byName = new Map(
        writer.calls.map((call) => [call.name, call.options])
      );

      expect(byName.get(AUTH_COOKIE_NAMES.CSRF_TOKEN)?.maxAge).toBe(
        byName.get(AUTH_COOKIE_NAMES.REFRESH_TOKEN)?.maxAge
      );
    });

    it('stays readable by JavaScript', () => {
      // Persisting it must not tempt anyone into locking it down: the
      // double-submit header is copied from this value by the browser client.
      expect(csrfWriteOptions().httpOnly).toBe(false);
    });

    it('keeps the shared path and sameSite of the other auth cookies', () => {
      const writer = captureWrite();
      runWriter(writer.res);

      const byName = new Map(
        writer.calls.map((call) => [call.name, call.options])
      );
      const csrf = byName.get(AUTH_COOKIE_NAMES.CSRF_TOKEN)!;
      const refresh = byName.get(AUTH_COOKIE_NAMES.REFRESH_TOKEN)!;

      expect(csrf.path).toBe(refresh.path);
      expect(csrf.sameSite).toBe(refresh.sameSite);
      expect(csrf.secure).toBe(refresh.secure);
      expect(csrf.domain).toBe(refresh.domain);
    });

    it('is still deleted, not re-issued for a week, when logout clears it', async () => {
      const clearer = captureClear();
      await runClearer(clearer.res);

      const csrf = clearer.calls.find(
        (call) => call.name === AUTH_COOKIE_NAMES.CSRF_TOKEN
      )!.options;

      // `res.clearCookie` strips `maxAge` before forcing `expires` to the
      // epoch. Asserting the option reaches it unchanged documents that this
      // depends on Express doing so — if that ever stops being true, logout
      // would hand back a 7-day empty cookie instead of removing it, which the
      // wire-level e2e assertion in auth-v1 would then catch.
      expect(csrf.maxAge).toBe(CSRF_TOKEN_COOKIE_MAX_AGE_MS);
    });
  });
});
