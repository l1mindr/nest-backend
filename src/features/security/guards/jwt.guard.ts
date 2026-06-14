import { IRequest } from '@infrastructure/http/interfaces/custom-request.interface';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtStrategy } from '../strategies/jwt.strategy';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwtStrategy: JwtStrategy,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<IRequest>();

    const { user, session } = await this.jwtStrategy.authenticate(req);

    req.user = user;
    req.session = session;

    return true;
  }
}
