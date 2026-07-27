import { Roles } from '@features/security/decorators/roles.decorator';
import { RolesGuard } from '@features/security/guards/roles.guard';
import { IdDto } from '@infrastructure/http/dto/id.dto';
import { Serialize } from '@infrastructure/http/interceptors/decorators/serialize.decorator';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Query,
  UseGuards
} from '@nestjs/common';
import { AdminUsersListRequestDto } from './dto/request/admin-users-list.request.dto';
import { AdminUserResponseDto } from './dto/response/admin-user.response.dto';
import { UserRole } from './enums/user-role.enum';
import {
  ADMIN_USERS_SERVICE,
  IAdminUsersService
} from './interfaces/users.interface';
import { UserMapper } from './application/mapping/user.mapper';
import { ApiAdminGetAllUsers, ApiAdminGetUser } from './users.swagger';

@Controller({
  path: 'admin/users',
  version: '1'
})
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(
    @Inject(ADMIN_USERS_SERVICE)
    private readonly adminUsersService: IAdminUsersService
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiAdminGetAllUsers()
  async listUsers(@Query() query: AdminUsersListRequestDto) {
    const { items, nextCursor } = await this.adminUsersService.list(
      query.cursor,
      query.limit
    );

    return {
      items: UserMapper.toAdminList(items),
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
    return this.adminUsersService.findById(id);
  }
}
