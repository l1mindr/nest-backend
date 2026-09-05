import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { RequirePermissions } from '@features/security/decorators/require-permissions.decorator';
import { IRequest } from '@presentation/interfaces/custom-request.interface';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IdDto } from '@presentation/dto/id.dto';
import { CreateRoleRequestDto } from '../dto/request/create-role.request.dto';
import { PermissionSetRequestDto } from '../dto/request/permission-set.request.dto';
import { UpdateRoleRequestDto } from '../dto/request/update-role.request.dto';
import {
  CREATE_ROLE_USE_CASE,
  DELETE_ROLE_USE_CASE,
  GET_ROLE_USE_CASE,
  ICreateRoleUseCase,
  IDeleteRoleUseCase,
  IGetRoleUseCase,
  IListRolesUseCase,
  ISetRolePermissionsUseCase,
  IUpdateRoleUseCase,
  LIST_ROLES_USE_CASE,
  SET_ROLE_PERMISSIONS_USE_CASE,
  UPDATE_ROLE_USE_CASE
} from '../../application/interfaces/authorization.interface';
import { RoleMapper } from '../../application/mappers/role.mapper';
import {
  ApiRoleCreate,
  ApiRoleDelete,
  ApiRoleGet,
  ApiRoleList,
  ApiRoleSetPermissions,
  ApiRoleUpdate
} from '../swagger/authorization.swagger';

/**
 * Management of the role catalog. Assigning a role to an account lives on
 * `UserRolesController`, kept separate because it addresses a different
 * resource — the assignment, not the role definition.
 *
 * Every route requires a `ROLE_*` permission, and every `ROLE_*` permission is
 * owner-reserved, so in practice only the owner can reach this controller —
 * the same pattern `AdminAccountsController` uses for administrator
 * management, for the same reason: a role is powerful enough that creating or
 * editing one should not itself be delegable.
 */
@Controller({
  path: 'admin/roles',
  version: '1'
})
@ApiTags(ApiTagName.ADMIN_ACCOUNTS)
export class RolesController {
  constructor(
    @Inject(LIST_ROLES_USE_CASE)
    private readonly listRolesUseCase: IListRolesUseCase,
    @Inject(GET_ROLE_USE_CASE)
    private readonly getRoleUseCase: IGetRoleUseCase,
    @Inject(CREATE_ROLE_USE_CASE)
    private readonly createRoleUseCase: ICreateRoleUseCase,
    @Inject(UPDATE_ROLE_USE_CASE)
    private readonly updateRoleUseCase: IUpdateRoleUseCase,
    @Inject(DELETE_ROLE_USE_CASE)
    private readonly deleteRoleUseCase: IDeleteRoleUseCase,
    @Inject(SET_ROLE_PERMISSIONS_USE_CASE)
    private readonly setRolePermissionsUseCase: ISetRolePermissionsUseCase,
    private readonly roleMapper: RoleMapper
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ROLE_READ)
  @ApiRoleList()
  async listRoles() {
    return {
      items: this.roleMapper.toResponseList(
        await this.listRolesUseCase.execute()
      )
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ROLE_READ)
  @ApiRoleGet()
  async getRole(@Param() { id }: IdDto) {
    return this.roleMapper.toResponse(await this.getRoleUseCase.execute(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.ROLE_CREATE)
  @ApiRoleCreate()
  async createRole(@Body() body: CreateRoleRequestDto) {
    const role = await this.createRoleUseCase.execute(body);

    return this.roleMapper.toResponse({ role, permissions: [] });
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ROLE_UPDATE)
  @ApiRoleUpdate()
  async updateRole(
    @Param() { id }: IdDto,
    @Body() body: UpdateRoleRequestDto
  ): Promise<void> {
    await this.updateRoleUseCase.execute(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ROLE_DELETE)
  @ApiRoleDelete()
  async deleteRole(@Param() { id }: IdDto): Promise<void> {
    await this.deleteRoleUseCase.execute(id);
  }

  @Put(':id/permissions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ROLE_UPDATE)
  @ApiRoleSetPermissions()
  async setRolePermissions(
    @Param() { id }: IdDto,
    @Body() body: PermissionSetRequestDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.setRolePermissionsUseCase.execute(req.user, id, body);
  }
}
