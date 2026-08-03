import { AuthErrors } from '@features/auth/domain/errors/auth-errors';
import { SessionErrors } from '@features/sessions/domain/errors/session-errors';
import { TokenErrors } from '@features/token/errors/token-errors';
import { UserErrors } from '@features/users/domain/errors/user-errors';
import {
  badRequestResponse,
  credentialsRejectedResponse,
  csrfForbiddenResponse,
  forbiddenResponse,
  internalServerErrorResponse,
  rateLimitResponse,
  unauthorizedResponse,
  validationError,
  validationResponse
} from '@presentation/swagger/api-error.catalog';
import {
  ApiEmptyBodyResponse,
  ApiErrorResponses,
  ApiNoContent,
  errorExample
} from '@presentation/swagger/api-response.decorator';
import {
  ApiCsrfProtected,
  ApiRefreshTokenAuth
} from '@presentation/swagger/api-security.decorator';
import { authCookieHeaders } from '@presentation/swagger/cookie.headers';
import { ApiRequestBody } from '@presentation/swagger/api-request.decorator';
import {
  AuthCookie,
  ExampleValue
} from '@presentation/swagger/openapi.constants';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ChangePasswordRequestDto } from '../dto/request/change-password.request.dto';
import { LoginUserRequestDto } from '../dto/request/login-user.request.dto';
import { RegisterUserRequestDto } from '../dto/request/register-user.request.dto';
import { ResendVerificationRequestDto } from '../dto/request/resend-verification.request.dto';
import { VerifyEmailRequestDto } from '../dto/request/verify-email.request.dto';

/**
 * Operation documentation for `AuthController`.
 *
 * Every error example is derived from the factory the runtime actually throws,
 * so a documented `code` or `domain` cannot drift from the real response. The
 * rate-limit budgets quoted in the descriptions mirror the policy groups the
 * handlers declare via `@RateLimit()`, which are defined in
 * `@features/security/rate-limit/config/rate-limit.config`.
 */

const PATH = {
  REGISTER: '/v1/auth/register',
  VERIFY_EMAIL: '/v1/auth/verify-email',
  RESEND_VERIFICATION: '/v1/auth/resend-verification',
  LOGIN: '/v1/auth/login',
  REFRESH: '/v1/auth/refresh',
  CHANGE_PASSWORD: '/v1/auth/change-password'
} as const;

export const ApiRegisterUser = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'registerUser',
      summary: 'Register an account and send a verification code',
      description: [
        'Creates an account in `PENDING_VERIFICATION` and emails a six-digit code valid for three minutes.',
        '',
        'The account cannot authenticate until `POST /v1/auth/verify-email` activates it: logging in beforehand returns `403 ACCOUNT_NOT_VERIFIED` and triggers a fresh code. An account left unverified for 24 hours is deactivated.',
        '',
        'No tokens and no body are returned. Email delivery failures are logged but do not fail the request, so a `201` does not guarantee the message arrived; `POST /v1/auth/resend-verification` retries it.',
        '',
        'Rate limited to 5 per minute per address and 10 per minute per device. Public: no authentication and no CSRF token required.'
      ].join('\n')
    }),
    ApiRequestBody(RegisterUserRequestDto, [
      {
        summary: 'Create an account',
        value: {
          email: ExampleValue.EMAIL,
          username: ExampleValue.USERNAME,
          password: ExampleValue.PASSWORD
        }
      }
    ]),
    ApiEmptyBodyResponse({
      status: 201,
      description:
        'Account created and the verification email dispatched. No body is returned.'
    }),
    ApiErrorResponses(PATH.REGISTER, [
      validationResponse(
        'The body failed validation, or the email or username is already taken. `error.meta.field` names the offending property.',
        [
          errorExample(
            UserErrors.emailAlreadyExists(),
            'An account already uses this email'
          ),
          errorExample(
            UserErrors.usernameAlreadyExists(),
            'An account already uses this username'
          ),
          validationError('password', 'password must be valid'),
          validationError('email', 'email must be an email')
        ]
      ),
      rateLimitResponse(
        'More than 5 registration attempts were made from this IP within a minute.'
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiVerifyEmail = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'verifyEmail',
      summary: 'Activate an account with an emailed verification code',
      description: [
        'Moves a `PENDING_VERIFICATION` account to `ACTIVATE`, after which it can log in.',
        '',
        'Codes are single-use and expire three minutes after they are issued. Only the most recent code is valid — every resend invalidates the previous one.',
        '',
        'Wrong, expired, already-used and unknown codes all return the same `400 INVALID_VERIFICATION_CODE`, as does an email that was never registered. This is deliberate: the endpoint cannot be used to discover which addresses have accounts.',
        '',
        'Five failed attempts invalidate the code outright, and attempts are additionally capped at 5 per 10 minutes per email address — a limit no amount of IP rotation avoids.',
        '',
        'Rate limited on four dimensions, all of which must pass: 10 per minute per address, 10 per minute per device, 5 per 10 minutes per email, and 20 per 10 minutes per submitted code. Public: no authentication and no CSRF token required.'
      ].join('\n')
    }),
    ApiRequestBody(VerifyEmailRequestDto, [
      {
        summary: 'Confirm the email address',
        value: {
          email: ExampleValue.EMAIL,
          code: ExampleValue.VERIFICATION_CODE
        }
      }
    ]),
    ApiNoContent({
      description:
        'The account is now active and can authenticate through `POST /v1/auth/login`. No body is returned.'
    }),
    ApiErrorResponses(PATH.VERIFY_EMAIL, [
      badRequestResponse(
        'The code was not accepted. One code covers every failure mode so that nothing about the account is disclosed.',
        errorExample(
          UserErrors.invalidVerificationCode(),
          'Code is wrong, expired, already used, unknown, or the account is not pending verification'
        )
      ),
      validationResponse('The body is malformed.', [
        validationError('code', 'Verification code must be exactly 6 digits'),
        validationError('email', 'email must be an email')
      ]),
      rateLimitResponse(
        'One of the budgets for this route is exhausted — per address (10 per minute), per device (10 per minute), per email (5 per 10 minutes), or per submitted code (20 per 10 minutes). The response does not disclose which.'
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiResendVerification = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'resendVerification',
      summary: 'Send a fresh verification code',
      description: [
        'Issues a new code to an account still pending verification and invalidates the previous one, so only ever one code is live per account.',
        '',
        'The status is `204` in every case — unknown address, already-verified account, cooldown still running, or a code genuinely sent. Nothing distinguishes them, which is what stops the endpoint from being used to enumerate accounts. It follows that the status code alone does not mean an email was sent.',
        '',
        'Silently enforced limits: a 60-second cooldown between resends and a maximum of 5 resends per hour per account. Requests hitting either limit still return `200`.',
        '',
        'Rate limited to 5 per minute per address, 10 per minute per device, and 10 per hour per email — these budgets, unlike the cooldown and hourly caps above, do surface as `429`. Public: no authentication and no CSRF token required.'
      ].join('\n')
    }),
    ApiRequestBody(ResendVerificationRequestDto, [
      {
        summary: 'Request a new code',
        value: { email: ExampleValue.EMAIL }
      }
    ]),
    ApiNoContent({
      description:
        'The request was accepted. Whether a code was actually sent is deliberately not disclosed. No body is returned.'
    }),
    ApiErrorResponses(PATH.RESEND_VERIFICATION, [
      validationResponse('The body is malformed.', [
        validationError('email', 'email must be an email')
      ]),
      rateLimitResponse(
        'More than 5 resend requests were made from this IP within a minute.'
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiLoginUser = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'loginUser',
      summary: 'Authenticate and receive the session cookies',
      description: [
        'Accepts either an email address or a username in the `email` field, together with the password.',
        '',
        `On success three cookies are set — \`${AuthCookie.ACCESS_TOKEN}\`, \`${AuthCookie.REFRESH_TOKEN}\` and \`${AuthCookie.CSRF_TOKEN}\` — and no body is returned. **The tokens appear nowhere in the response body.** The two token cookies are \`HttpOnly\` and unreadable from JavaScript; the CSRF cookie is readable by design and must be echoed in the \`x-csrf-token\` header on later unsafe requests.`,
        '',
        'Each login opens a new session, so signing in from another device does not disturb existing ones. `GET /v1/sessions` lists them.',
        '',
        'Unknown account, wrong password, suspended and deactivated accounts are indistinguishable: all return `401 INVALID_CREDENTIALS`. An account still pending verification is the one exception — it returns `403 ACCOUNT_NOT_VERIFIED` and a fresh code is emailed automatically. Past 24 hours unverified the account is deactivated instead, and falls back to `401`.',
        '',
        'Rate limited on three dimensions, all of which must pass: 5 per minute per address, 10 per 15 minutes per email, and 10 per minute per device. Exceeding the email or device budget also opens a temporary block. A successful sign-in clears the email counter, so only failures accumulate. Public: no authentication and no CSRF token required.'
      ].join('\n')
    }),
    ApiRequestBody(LoginUserRequestDto, [
      {
        summary: 'Sign in by email',
        value: {
          email: ExampleValue.EMAIL,
          password: ExampleValue.PASSWORD
        }
      },
      {
        summary: 'Sign in by username',
        value: {
          email: ExampleValue.USERNAME,
          password: ExampleValue.PASSWORD
        }
      }
    ]),
    ApiEmptyBodyResponse({
      status: 200,
      description:
        'Authenticated. The session cookies are set on this response; no body is returned.',
      headers: authCookieHeaders()
    }),
    ApiErrorResponses(PATH.LOGIN, [
      credentialsRejectedResponse(
        'The credentials were rejected. One code covers every cause so that valid accounts cannot be probed.',
        errorExample(
          AuthErrors.invalidCredentials(),
          'Unknown account, wrong password, or the account is suspended or deactivated'
        )
      ),
      forbiddenResponse(
        'The account exists and the password was correct, but the email address has never been confirmed. A new verification code has just been emailed; complete `POST /v1/auth/verify-email` and retry.',
        errorExample(
          AuthErrors.accountNotVerified(),
          'Account is still pending verification'
        )
      ),
      validationResponse('The body is malformed.', [
        validationError('email', 'email should not be empty')
      ]),
      rateLimitResponse(
        'More than 5 login attempts were made from this IP within a minute.'
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiRefreshToken = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'refreshTokens',
      summary: 'Rotate the session cookies using the refresh token',
      description: [
        `Reads the \`${AuthCookie.REFRESH_TOKEN}\` cookie — nothing is taken from the request body — and issues a new access/refresh pair, replacing all three cookies. Call this once a request has failed with \`401\`, then retry it.`,
        '',
        '**Refresh tokens are single-use.** Each rotation invalidates the token it consumed. Replaying a spent token is treated as theft: the whole session is revoked immediately and `401 SESSION_REUSE_DETECTED` is returned, signing out every client on it. A client racing two refreshes against itself will trip this, so serialise them.',
        '',
        'Concurrent refreshes on one session are additionally guarded by a short lock; losing that race returns `429 REFRESH_RATE_LIMITED` and is safe to retry.',
        '',
        'Rate limited to 20 per minute per address and 20 per minute per device. No access token is required — the refresh cookie is the credential — and no CSRF token is required.'
      ].join('\n')
    }),
    ApiRefreshTokenAuth(),
    ApiEmptyBodyResponse({
      status: 200,
      description:
        'Rotated. Three replacement cookies are set and the refresh token just consumed is now void. No body is returned.',
      headers: authCookieHeaders()
    }),
    ApiErrorResponses(PATH.REFRESH, [
      credentialsRejectedResponse(
        'The refresh token was absent, unusable, or already spent. `SESSION_REUSE_DETECTED` additionally means the session has just been revoked as a precaution and every client on it must log in again.',
        errorExample(
          TokenErrors.invalidToken(),
          'Cookie is missing, malformed, or signed with a rotated secret'
        ),
        errorExample(
          SessionErrors.sessionExpired(),
          'The session was revoked or has expired'
        ),
        errorExample(
          SessionErrors.sessionReuseDetected(),
          'A spent refresh token was replayed; the session has been revoked'
        )
      ),
      rateLimitResponse(
        'Either a request budget for this route is exhausted (20 per minute per address or per device), or another refresh for this session is already in flight.',
        errorExample(
          SessionErrors.refreshRateLimited(),
          'A concurrent refresh holds the lock on this session; retry shortly'
        )
      ),
      internalServerErrorResponse()
    ])
  );

export const ApiChangePassword = () =>
  applyDecorators(
    ApiOperation({
      operationId: 'changePassword',
      summary: 'Change the password of the authenticated account',
      description: [
        'Requires the current password as well as the new one, so a stolen access token alone is not enough to lock an account out.',
        '',
        'On success **every other session is revoked** — any device signed in elsewhere is signed out. The calling session survives and its cookies stay valid, so no re-authentication is needed here.',
        '',
        'The new password must satisfy the same rules as at registration and must differ from the current one.',
        '',
        'Rate limited to 3 attempts per 5 minutes per address and per account. Requires authentication and, being a state-changing request, a valid `x-csrf-token` header.'
      ].join('\n')
    }),
    ApiCsrfProtected(),
    ApiRequestBody(ChangePasswordRequestDto, [
      {
        summary: 'Rotate the password',
        value: {
          currentPassword: ExampleValue.PASSWORD,
          newPassword: 'N3w!Passw0rd'
        }
      }
    ]),
    ApiNoContent({
      description:
        'Password changed and all other sessions revoked. No body is returned.'
    }),
    ApiErrorResponses(PATH.CHANGE_PASSWORD, [
      badRequestResponse(
        'The request was authenticated but the passwords were not acceptable. `error.meta.field` names the offending property.',
        errorExample(
          AuthErrors.invalidCurrentPassword(),
          '`currentPassword` does not match the stored password'
        ),
        errorExample(
          AuthErrors.passwordMustBeDifferent(),
          '`newPassword` is identical to the current password'
        )
      ),
      unauthorizedResponse(),
      csrfForbiddenResponse(),
      validationResponse(
        'A password failed the strength rules before it was ever compared.',
        [validationError('newPassword', 'newPassword must be valid')]
      ),
      rateLimitResponse(
        'More than 3 password changes were attempted from this IP within 5 minutes.'
      ),
      internalServerErrorResponse(
        errorExample(
          AuthErrors.passwordChangeFailed(),
          'The password update and session revocation transaction was rolled back; the password is unchanged'
        )
      )
    ])
  );
