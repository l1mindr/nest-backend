import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';

const isProduction = process.env.NODE_ENV === 'production';

@Injectable()
export class ClearCsrfCookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        res.clearCookie('csrf_token', {
          httpOnly: false,
          secure: isProduction,
          sameSite: isProduction ? 'strict' : 'lax'
        });
      })
    );
  }
}
