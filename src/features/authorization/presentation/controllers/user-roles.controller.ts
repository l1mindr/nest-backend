import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { RequirePermissions } from '@features/security/decorators/require-permissions.decorator';
import { IRequest } from '@presentation/interfaces/custom-request.interface';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IdDto } from '@presentation/dto/id.dto';
import { UserRoleParamsDto } from '../dto/request/user-role-params.request.dto';
import {
  ASSIGN_ROLE_USE_CASE,
  IAssignRoleUseCase,
  IListUserRolesUseCase,
  IUnassignRoleUseCase,
  LIST_USER_ROLES_USE_CASE,
  UNASSIGN_ROLE_USE_CASE
} from '../../application/interfaces/authorization.interface';
import { RoleMapper } from '../../application/mappers/role.mapper';
import {
  ApiUserRoleAssign,
  ApiUserRoleUnassign,
  ApiUserRolesList
} from '../swagger/authorization.swagger';

/**
 * The role assignments held by an account — the `user_role_assignment` join,
 * addressed from the account's side.
 *
 * Not scoped to administrators: any non-owner account can be resolved and
 * assigned a role here, which is what makes a role a general instrument
 * rather than an extension of the administrator-only grant endpoints on
 * `AdminAccountsController`.
 */
@Controller({
  path: 'admin/users/:id/roles',
  version: '1'
})
@ApiTags(ApiTagName.ADMIN_ACCOUNTS)
export class UserRolesController {
  constructor(
    @Inject(LIST_USER_ROLES_USE_CASE)
    private readonly listUserRolesUseCase: IListUserRolesUseCase,
    @Inject(ASSIGN_ROLE_USE_CASE)
    private readonly assignRoleUseCase: IAssignRoleUseCase,
    @Inject(UNASSIGN_ROLE_USE_CASE)
    private readonly unassignRoleUseCase: IUnassignRoleUseCase,
    private readonly roleMapper: RoleMapper
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ROLE_READ)
  @ApiUserRolesList()
  async listRoles(@Param() { id }: IdDto) {
    return {
      items: this.roleMapper.toResponseList(
        await this.listUserRolesUseCase.execute(id)
      )
    };
  }

  @Post(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ROLE_ASSIGN)
  @ApiUserRoleAssign()
  async assignRole(
    @Param() { id, roleId }: UserRoleParamsDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.assignRoleUseCase.execute(req.user, id, roleId);
  }

  @Delete(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ROLE_ASSIGN)
  @ApiUserRoleUnassign()
  async unassignRole(
    @Param() { id, roleId }: UserRoleParamsDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.unassignRoleUseCase.execute(req.user, id, roleId);
  }
}
