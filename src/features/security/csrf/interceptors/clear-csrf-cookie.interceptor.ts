import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { IS_PRODUCTION } from '@infrastructure/config/env/env.constants';

@Injectable()
export class ClearCsrfCookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        res.clearCookie('csrf_token', {
          httpOnly: false,
          secure: IS_PRODUCTION,
          sameSite: IS_PRODUCTION ? 'strict' : 'lax'
        });
      })
    );
  }
}
