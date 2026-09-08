import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { CsrfTokenService } from '@features/security/csrf/services/csrf-token.service';
import { decodeSessionId } from '@features/security/csrf/utils/session-id.util';
import { AuthTokens } from '../interfaces/auth.interface';
import {
  ACCESS_TOKEN_COOKIE_MAX_AGE_MS,
  AUTH_COOKIE_NAMES,
  REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  csrfCookieOptions,
  tokenCookieOptions
} from './auth-cookie.constants';

@Injectable()
export class AuthCookieService {
  constructor(private readonly csrfTokenService: CsrfTokenService) {}

  set(res: Response, tokens: AuthTokens): void {
    const { accessToken, refreshToken } = tokens;

    res.cookie(
      AUTH_COOKIE_NAMES.ACCESS_TOKEN,
      accessToken,
      tokenCookieOptions(ACCESS_TOKEN_COOKIE_MAX_AGE_MS)
    );

    res.cookie(
      AUTH_COOKIE_NAMES.REFRESH_TOKEN,
      refreshToken,
      tokenCookieOptions(REFRESH_TOKEN_COOKIE_MAX_AGE_MS)
    );

    const sessionId = decodeSessionId(accessToken);

    if (sessionId) {
      const csrfToken = this.csrfTokenService.issue(sessionId);

      res.cookie(AUTH_COOKIE_NAMES.CSRF_TOKEN, csrfToken, csrfCookieOptions());
    }
  }
}
