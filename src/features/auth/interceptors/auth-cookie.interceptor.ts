import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Response } from 'express';
import { map, Observable } from 'rxjs';
import { AuthTokens } from '../interfaces/auth.interface';
import { CsrfService } from '@features/security/csrf/csrf.service';

@Injectable()
export class AuthCookieInterceptor implements NestInterceptor {
  constructor(private readonly csrfService: CsrfService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<void> {
    const ctx = context.switchToHttp();
    const res = ctx.getResponse<Response>();
    const isProduction = process.env.NODE_ENV === 'production';

    return next.handle().pipe(
      map(({ accessToken, refreshToken }: AuthTokens) => {
        if (accessToken && refreshToken) {
          res.cookie('access_token', accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
            maxAge: 15 * 60 * 1000 // 15 minutes
          });

          res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          });

          const csrfToken = this.csrfService.generateToken();

          res.cookie('csrf_token', csrfToken, {
            httpOnly: false,
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax'
          });
        }

        return;
      })
    );
  }
}
