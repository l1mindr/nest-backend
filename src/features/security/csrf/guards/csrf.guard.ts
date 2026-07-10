import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CsrfService } from '../csrf.service';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly csrfService: CsrfService
  ) {}

  private isSafeMethod(method: string): boolean {
    return ['GET', 'HEAD', 'OPTIONS'].includes(method);
  }

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (this.isSafeMethod(request.method)) {
      return true;
    }

    const cookieToken = request.cookies?.csrf_token;

    const headerToken = request.header('x-csrf-token');

    const valid = this.csrfService.validate(cookieToken, headerToken);

    if (!valid) {
      throw new ForbiddenException('Invalid CSRF token.');
    }

    return true;
  }
}
