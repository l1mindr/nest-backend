import { ApiResponseOptions } from '@nestjs/swagger';
import { AuthCookie, CSRF_HEADER } from './openapi.constants';

type ResponseHeaders = ApiResponseOptions['headers'];

/**
 * `Set-Cookie` documentation for the endpoints that authenticate through
 * cookies rather than through a response body.
 *
 * OpenAPI 3.0 keys response headers by name, so several `Set-Cookie` headers
 * on one response cannot be listed separately. They are described together
 * instead, with the example showing the production flags.
 */

/** Flags used in the examples; production adds `Secure` and `SameSite=Strict`. */
const PRODUCTION_FLAGS = 'Path=/; Secure; SameSite=Strict';

/** Both token cookies plus the CSRF cookie, as issued by login and refresh. */
export const authCookieHeaders = (): ResponseHeaders => ({
  'Set-Cookie': {
    description: [
      'Three cookies are set on this response and the tokens appear nowhere else — no body is returned.',
      '',
      `- \`${AuthCookie.ACCESS_TOKEN}\` — \`HttpOnly\`, 15 minutes. Sent automatically on every subsequent request.`,
      `- \`${AuthCookie.REFRESH_TOKEN}\` — \`HttpOnly\`, 7 days. Consumed by \`POST /v1/auth/refresh\`, single-use.`,
      `- \`${AuthCookie.CSRF_TOKEN}\` — readable by JavaScript. Copy its value into the \`${CSRF_HEADER}\` header on every unsafe request.`,
      '',
      'Any previously issued pair is replaced. In development the cookies drop `Secure` and use `SameSite=Lax` so they work over plain HTTP.'
    ].join('\n'),
    schema: {
      type: 'string',
      example: `${AuthCookie.ACCESS_TOKEN}=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Max-Age=900; ${PRODUCTION_FLAGS}; HttpOnly`
    }
  }
});

/** Expiry of the CSRF cookie, sent when the current session is revoked. */
export const clearedCsrfCookieHeader = (): ResponseHeaders => ({
  'Set-Cookie': {
    description: `Expires the \`${AuthCookie.CSRF_TOKEN}\` cookie. The \`HttpOnly\` token cookies are **not** cleared by this response: the session behind them is revoked server-side, so they stop being accepted, but they remain in the browser until they expire on their own.`,
    schema: {
      type: 'string',
      example: `${AuthCookie.CSRF_TOKEN}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${PRODUCTION_FLAGS}`
    }
  }
});
