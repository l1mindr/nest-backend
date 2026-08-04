import {
  IPermissionEvaluationService,
  PERMISSION_EVALUATION_SERVICE
} from '@features/authorization/application/interfaces/authorization.interface';
import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { IRequest } from '@presentation/interfaces/custom-request.interface';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { SecurityErrors } from '../errors/security-errors';

/**
 * Turns the `@RequirePermissions()` metadata on a route into a decision, by
 * asking the evaluation service. It holds no rule of its own: owner bypass and
 * grant lookup both live in the service, so the same answer is reached whether
 * the question is asked here or from inside a use case.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PERMISSION_EVALUATION_SERVICE)
    private readonly permissionEvaluation: IPermissionEvaluationService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!required?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<IRequest>();

    if (!user?.role) {
      throw SecurityErrors.accessDenied();
    }

    await this.permissionEvaluation.assertCan(user, required);

    return true;
  }
}
