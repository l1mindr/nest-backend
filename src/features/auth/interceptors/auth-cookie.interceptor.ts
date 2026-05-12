import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { IAuthTokens } from '../interfaces/auth.interface';

@Injectable()
export class AuthCookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const res = ctx.getResponse<Response>();
    const isProduction = process.env.NODE_ENV === 'production';

    return next.handle().pipe(
      tap(({ accessToken, refreshToken }: IAuthTokens) => {
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
        }
      })
    );
  }
}
