import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Response } from 'express';
import { map, Observable } from 'rxjs';
import { AuthTokens } from '../interfaces/auth.interface';
import { AuthCookieService } from '../application/services/auth-cookie.service';

@Injectable()
export class AuthCookieInterceptor implements NestInterceptor {
  constructor(private readonly authCookieService: AuthCookieService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<void> {
    const ctx = context.switchToHttp();
    const res = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((tokens: AuthTokens) => {
        if (tokens?.accessToken && tokens?.refreshToken) {
          this.authCookieService.set(res, tokens);
        }

        return;
      })
    );
  }
}
