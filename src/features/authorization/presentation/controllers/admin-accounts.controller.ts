import { Permission } from '@features/authorization/domain/enums/permission.enum';
import { RequirePermissions } from '@features/security/decorators/require-permissions.decorator';
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
import { PermissionSetRequestDto } from '../dto/request/permission-set.request.dto';
import { UpdateAdminRequestDto } from '../dto/request/update-admin.request.dto';
import {
  ADMIN_DIRECTORY_USE_CASE,
  CHANGE_ADMIN_STATUS_USE_CASE,
  DELETE_ADMIN_USE_CASE,
  GRANT_PERMISSIONS_USE_CASE,
  IAdminDirectoryUseCase,
  IChangeAdminStatusUseCase,
  IDeleteAdminUseCase,
  IGrantPermissionsUseCase,
  IRevokePermissionsUseCase,
  IUpdateAdminUseCase,
  REVOKE_PERMISSIONS_USE_CASE,
  UPDATE_ADMIN_USE_CASE
} from '../../application/interfaces/authorization.interface';
import { AdminAccountMapper } from '../../application/mappers/admin-account.mapper';
import {
  ApiAdminActivate,
  ApiAdminDeactivate,
  ApiAdminDelete,
  ApiAdminGet,
  ApiAdminGrantPermissions,
  ApiAdminList,
  ApiAdminRevokePermissions,
  ApiAdminSelf,
  ApiAdminSuspend,
  ApiAdminUnsuspend,
  ApiAdminUpdate
} from '../swagger/authorization.swagger';

/**
 * Administration of administrators, kept entirely separate from the user
 * endpoints so that neither population can be reached through the other's
 * routes.
 *
 * Every route declares a permission rather than a role, including the ones only
 * the owner can currently use: the `ADMIN_*` and `ROLE_ASSIGN` codes are marked
 * owner-reserved in `PERMISSION_CATALOG`, so no administrator can be granted
 * them and the guard refuses on the ordinary permission path. That is what makes
 * administrator management owner-only without a single role check in this class
 * — and what makes relaxing it later one flag in the catalog rather than a
 * rewrite of these controllers.
 *
 * The one exception is `GET /me`, which is scoped to the caller and so needs no
 * permission at all. It is why an administrator refused the directory still has
 * somewhere to read their own profile and grants.
 *
 * No rule is evaluated here; the decorators declare what is needed and the use
 * cases enforce what may be touched.
 */
@Controller({
  path: 'admin/administrators',
  version: '1'
})
@ApiTags(ApiTagName.ADMIN_ACCOUNTS)
export class AdminAccountsController {
  constructor(
    @Inject(ADMIN_DIRECTORY_USE_CASE)
    private readonly adminDirectoryUseCase: IAdminDirectoryUseCase,
    @Inject(DELETE_ADMIN_USE_CASE)
    private readonly deleteAdminUseCase: IDeleteAdminUseCase,
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

  /**
   * Declared before `:id` so the literal segment wins the match — Nest resolves
   * routes in declaration order.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiAdminSelf()
  async getSelf(@Req() req: IRequest) {
    return this.adminAccountMapper.toResponse(
      await this.adminDirectoryUseCase.findSelf(req.user)
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.ADMIN_READ)
  @ApiAdminGet()
  async getAdmin(@Param() { id }: IdDto, @Req() req: IRequest) {
    return this.adminAccountMapper.toResponse(
      await this.adminDirectoryUseCase.findById(req.user, id)
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ADMIN_DELETE)
  @ApiAdminDelete()
  async deleteAdmin(
    @Param() { id }: IdDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.deleteAdminUseCase.execute(req.user.id, id);
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
  @RequirePermissions(Permission.ADMIN_STATUS)
  @ApiAdminActivate()
  async activateAdmin(
    @Param() { id }: IdDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.changeAdminStatusUseCase.activate(req.user.id, id);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ADMIN_STATUS)
  @ApiAdminDeactivate()
  async deactivateAdmin(
    @Param() { id }: IdDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.changeAdminStatusUseCase.deactivate(req.user.id, id);
  }

  /**
   * Suspension is the same operation the user routes expose, reached through a
   * route only the owner can call. `ADMIN` is passed as the population being
   * administered, which is what stops this route touching an ordinary user and
   * the user route touching an administrator.
   */
  @Post(':id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ADMIN_STATUS)
  @ApiAdminSuspend()
  async suspendAdmin(
    @Param() { id }: IdDto,
    @Body() body: SuspendUserRequestDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.suspendUserUseCase.execute(
      req.user.id,
      id,
      body.reason,
      UserRole.ADMIN
    );
  }

  @Patch(':id/unsuspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.ADMIN_STATUS)
  @ApiAdminUnsuspend()
  async unsuspendAdmin(
    @Param() { id }: IdDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.unsuspendUserUseCase.execute(req.user.id, id, UserRole.ADMIN);
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
