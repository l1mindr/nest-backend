import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { RequirePermissions } from '@features/security/decorators/require-permissions.decorator';
import { Roles } from '@features/security/decorators/roles.decorator';
import { UserRole } from '@features/users/domain/enums/user-role.enum';
import { SuspendUserRequestDto } from '@features/users/presentation/dto/request/suspend-user.request.dto';
import {
  ISuspendUserUseCase,
  IUnsuspendUserUseCase,
  SUSPEND_USER_USE_CASE,
  UNSUSPEND_USER_USE_CASE
} from '@features/users/application/interfaces/users.interface';
import { IdDto } from '@presentation/dto/id.dto';
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
  Query,
  Req
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminListRequestDto } from '../dto/request/admin-list.request.dto';
import { CreateAdminRequestDto } from '../dto/request/create-admin.request.dto';
import { PermissionSetRequestDto } from '../dto/request/permission-set.request.dto';
import { UpdateAdminRequestDto } from '../dto/request/update-admin.request.dto';
import {
  ADMIN_DIRECTORY_USE_CASE,
  CHANGE_ADMIN_STATUS_USE_CASE,
  GRANT_ADMIN_ROLE_USE_CASE,
  GRANT_PERMISSIONS_USE_CASE,
  IAdminDirectoryUseCase,
  IChangeAdminStatusUseCase,
  IGrantAdminRoleUseCase,
  IGrantPermissionsUseCase,
  IRevokeAdminRoleUseCase,
  IRevokePermissionsUseCase,
  IUpdateAdminUseCase,
  REVOKE_ADMIN_ROLE_USE_CASE,
  REVOKE_PERMISSIONS_USE_CASE,
  UPDATE_ADMIN_USE_CASE
} from '../../application/interfaces/authorization.interface';
import { AdminAccountMapper } from '../../application/mappers/admin-account.mapper';
import {
  ApiAdminActivate,
  ApiAdminCreate,
  ApiAdminDeactivate,
  ApiAdminDelete,
  ApiAdminGet,
  ApiAdminGrantPermissions,
  ApiAdminList,
  ApiAdminRevokePermissions,
  ApiAdminSuspend,
  ApiAdminUnsuspend,
  ApiAdminUpdate
} from '../swagger/authorization.swagger';

/**
 * Administration of administrators.
 *
 * Two kinds of gate appear here, and the difference is deliberate. Reads and
 * edits are permission-driven, so the owner can delegate them. The lifecycle of
 * an administrator — who becomes one, who stops being one, whose access is
 * switched off — is reserved to the owner by role, because an administrator who
 * could create or unmake administrators would effectively hold every permission
 * by proxy.
 *
 * No rule is evaluated in this class; the decorators declare what is needed and
 * the use cases enforce what may be touched.
 */
@Controller({
  path: 'admin/admins',
  version: '1'
})
@ApiTags(ApiTagName.ADMIN_ACCOUNTS)
export class AdminAccountsController {
  constructor(
    @Inject(ADMIN_DIRECTORY_USE_CASE)
    private readonly adminDirectoryUseCase: IAdminDirectoryUseCase,
    @Inject(GRANT_ADMIN_ROLE_USE_CASE)
    private readonly grantAdminRoleUseCase: IGrantAdminRoleUseCase,
    @Inject(REVOKE_ADMIN_ROLE_USE_CASE)
    private readonly revokeAdminRoleUseCase: IRevokeAdminRoleUseCase,
    @Inject(CHANGE_ADMIN_STATUS_USE_CASE)
    private readonly changeAdminStatusUseCase: IChangeAdminStatusUseCase,
    @Inject(UPDATE_ADMIN_USE_CASE)
    private readonly updateAdminUseCase: IUpdateAdminUseCase,
    @Inject(GRANT_PERMISSIONS_USE_CASE)
    private readonly grantPermissionsUseCase: IGrantPermissionsUseCase,
    @Inject(REVOKE_PERMISSIONS_USE_CASE)
    private readonly revokePermissionsUseCase: IRevokePermissionsUseCase,
    @Inject(SUSPEND_USER_USE_CASE)
    private readonly suspendUserUseCase: ISuspendUserUseCase,
    @Inject(UNSUSPEND_USER_USE_CASE)
    private readonly unsuspendUserUseCase: IUnsuspendUserUseCase,
    private readonly adminAccountMapper: AdminAccountMapper
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ADMIN_READ)
  @ApiAdminList()
  async listAdmins(@Query() query: AdminListRequestDto) {
    const { items, nextCursor } = await this.adminDirectoryUseCase.list(
      query.cursor,
      query.limit
    );

    return {
      items: this.adminAccountMapper.toResponseList(items),
      nextCursor
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ADMIN_READ)
  @ApiAdminGet()
  async getAdmin(@Param() { id }: IdDto) {
    return this.adminAccountMapper.toResponse(
      await this.adminDirectoryUseCase.findById(id)
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER)
  @ApiAdminCreate()
  async createAdmin(@Body() body: CreateAdminRequestDto, @Req() req: IRequest) {
    return this.adminAccountMapper.toResponse(
      await this.grantAdminRoleUseCase.execute(req.user.id, body)
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER)
  @ApiAdminDelete()
  async deleteAdmin(
    @Param() { id }: IdDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.revokeAdminRoleUseCase.execute(req.user.id, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ADMIN_UPDATE)
  @ApiAdminUpdate()
  async updateAdmin(
    @Param() { id }: IdDto,
    @Body() body: UpdateAdminRequestDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.updateAdminUseCase.execute(req.user.id, id, body);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER)
  @ApiAdminActivate()
  async activateAdmin(
    @Param() { id }: IdDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.changeAdminStatusUseCase.activate(req.user.id, id);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER)
  @ApiAdminDeactivate()
  async deactivateAdmin(
    @Param() { id }: IdDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.changeAdminStatusUseCase.deactivate(req.user.id, id);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER)
  @ApiAdminSuspend()
  async suspendAdmin(
    @Param() { id }: IdDto,
    @Body() body: SuspendUserRequestDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.suspendUserUseCase.execute(req.user.id, id, body.reason);
  }

  @Patch(':id/unsuspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER)
  @ApiAdminUnsuspend()
  async unsuspendAdmin(
    @Param() { id }: IdDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.unsuspendUserUseCase.execute(req.user.id, id);
  }

  @Post(':id/permissions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ROLE_ASSIGN)
  @ApiAdminGrantPermissions()
  async grantPermissions(
    @Param() { id }: IdDto,
    @Body() body: PermissionSetRequestDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.grantPermissionsUseCase.execute(req.user, id, body);
  }

  @Delete(':id/permissions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ROLE_ASSIGN)
  @ApiAdminRevokePermissions()
  async revokePermissions(
    @Param() { id }: IdDto,
    @Body() body: PermissionSetRequestDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.revokePermissionsUseCase.execute(req.user, id, body);
  }
}
