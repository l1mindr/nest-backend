import { Roles } from '@features/security/decorators/roles.decorator';
import { RolesGuard } from '@features/security/guards/roles.guard';
import { IdDto } from '@presentation/dto/id.dto';
import { Serialize } from '@presentation/interceptors/decorators/serialize.decorator';
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
import { AdminUsersListRequestDto } from '../dto/request/admin-users-list.request.dto';
import { AdminUserResponseDto } from '../dto/response/admin-user.response.dto';
import { UserRole } from '../../domain/enums/user-role.enum';
import {
  ADMIN_USERS_USE_CASE,
  IAdminUsersUseCase
} from '../../application/interfaces/users.interface';
import { UserMapper } from '../../application/mappers/user.mapper';
import { ApiAdminGetAllUsers, ApiAdminGetUser } from '../swagger/users.swagger';

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
}
