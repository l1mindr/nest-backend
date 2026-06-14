import { IRequest } from '@infrastructure/http/interfaces/custom-request.interface';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { SecurityErrors } from '../errors/security-errors';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<IRequest>();

    if (!user?.role) {
      throw SecurityErrors.accessDenied();
    }

    if (!requiredRoles.includes(user.role)) {
      throw SecurityErrors.accessDenied();
    }

    return true;
  }
}
