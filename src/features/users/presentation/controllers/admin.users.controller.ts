import { IRequest } from '@presentation/interfaces/custom-request.interface';
import { Roles } from '@features/security/decorators/roles.decorator';
import { RolesGuard } from '@features/security/guards/roles.guard';
import { IdDto } from '@presentation/dto/id.dto';
import { Serialize } from '@presentation/interceptors/decorators/serialize.decorator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { AdminUsersListRequestDto } from '../dto/request/admin-users-list.request.dto';
import { SuspendUserRequestDto } from '../dto/request/suspend-user.request.dto';
import { AdminUserResponseDto } from '../dto/response/admin-user.response.dto';
import { UserRole } from '../../domain/enums/user-role.enum';
import {
  ADMIN_USERS_USE_CASE,
  IAdminUsersUseCase,
  ISuspendUserUseCase,
  IUnsuspendUserUseCase,
  SUSPEND_USER_USE_CASE,
  UNSUSPEND_USER_USE_CASE
} from '../../application/interfaces/users.interface';
import { UserMapper } from '../../application/mappers/user.mapper';
import {
  ApiAdminGetAllUsers,
  ApiAdminGetUser,
  ApiAdminSuspendUser,
  ApiAdminUnsuspendUser
} from '../swagger/users.swagger';

@Controller({
  path: 'admin/users',
  version: '1'
})
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(
    @Inject(ADMIN_USERS_USE_CASE)
    private readonly adminUsersUseCase: IAdminUsersUseCase,
    @Inject(SUSPEND_USER_USE_CASE)
    private readonly suspendUserUseCase: ISuspendUserUseCase,
    @Inject(UNSUSPEND_USER_USE_CASE)
    private readonly unsuspendUserUseCase: IUnsuspendUserUseCase,
    private readonly userMapper: UserMapper
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiAdminGetAllUsers()
  async listUsers(@Query() query: AdminUsersListRequestDto) {
    const { items, nextCursor } = await this.adminUsersUseCase.list(
      query.cursor,
      query.limit
    );

    return {
      items: this.userMapper.toAdminList(items),
      nextCursor
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiAdminGetUser()
  @Serialize(AdminUserResponseDto)
  getUser(
    @Param()
    { id }: IdDto
  ) {
    return this.adminUsersUseCase.findById(id);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiAdminSuspendUser()
  async suspendUser(
    @Param() { id }: IdDto,
    @Body() body: SuspendUserRequestDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.suspendUserUseCase.execute(req.user.id, id, body.reason);
  }

  @Patch(':id/unsuspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiAdminUnsuspendUser()
  async unsuspendUser(
    @Param() { id }: IdDto,
    @Req() req: IRequest
  ): Promise<void> {
    await this.unsuspendUserUseCase.execute(req.user.id, id);
  }
}
