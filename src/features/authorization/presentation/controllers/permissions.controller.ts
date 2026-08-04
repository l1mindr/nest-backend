import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { RequirePermissions } from '@features/security/decorators/require-permissions.decorator';
import { IRequest } from '@presentation/interfaces/custom-request.interface';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Req
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EffectivePermissionsResponseDto } from '../dto/response/effective-permissions.response.dto';
import { PermissionCatalogResponseDto } from '../dto/response/permission-catalog.response.dto';
import {
  IListPermissionsUseCase,
  IPermissionEvaluationService,
  LIST_PERMISSIONS_USE_CASE,
  PERMISSION_EVALUATION_SERVICE
} from '../../application/interfaces/authorization.interface';
import { AdminAccountMapper } from '../../application/mappers/admin-account.mapper';
import {
  ApiListPermissions,
  ApiMyPermissions
} from '../swagger/authorization.swagger';

@Controller({
  path: 'admin/permissions',
  version: '1'
})
@ApiTags(ApiTagName.ADMIN_ACCOUNTS)
export class PermissionsController {
  constructor(
    @Inject(LIST_PERMISSIONS_USE_CASE)
    private readonly listPermissionsUseCase: IListPermissionsUseCase,
    @Inject(PERMISSION_EVALUATION_SERVICE)
    private readonly permissionEvaluation: IPermissionEvaluationService,
    private readonly adminAccountMapper: AdminAccountMapper
  ) {}

  /**
   * Deliberately open to any authenticated caller, and deliberately scoped to
   * the caller: it reports what *you* can do. A client that renders its
   * navigation from this reads the same answer the server enforces instead of
   * inferring reach from the role and drifting out of step with it. An ordinary
   * user simply sees an empty list.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiMyPermissions()
  async myPermissions(
    @Req() req: IRequest
  ): Promise<EffectivePermissionsResponseDto> {
    return {
      role: req.user.role,
      permissions: await this.permissionEvaluation.effectivePermissionsOf(
        req.user
      )
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ADMIN_READ)
  @ApiListPermissions()
  async listPermissions(): Promise<PermissionCatalogResponseDto> {
    return {
      items: this.adminAccountMapper.toCatalogList(
        await this.listPermissionsUseCase.execute()
      )
    };
  }
}
