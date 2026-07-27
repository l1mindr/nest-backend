import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { CsrfTokenService } from '@features/security/csrf/services/csrf-token.service';
import { decodeSessionId } from '@features/security/csrf/utils/session-id.util';
import { IS_PRODUCTION } from '@infrastructure/config/env/env.constants';
import { AuthTokens } from '../../interfaces/auth.interface';

@Injectable()
export class AuthCookieService {
  constructor(private readonly csrfTokenService: CsrfTokenService) {}

  set(res: Response, tokens: AuthTokens): void {
    const { accessToken, refreshToken } = tokens;

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const sessionId = decodeSessionId(accessToken);

    if (sessionId) {
      const csrfToken = this.csrfTokenService.issue(sessionId);

      res.cookie('csrf_token', csrfToken, {
        httpOnly: false,
        secure: IS_PRODUCTION,
        sameSite: IS_PRODUCTION ? 'strict' : 'lax'
      });
    }
  }
}
