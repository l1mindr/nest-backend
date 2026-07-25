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
import { plainToInstance } from 'class-transformer';
import { AdminUsersListRequestDto } from './dto/request/admin-users-list.request.dto';
import { AdminUserResponseDto } from './dto/response/admin-user.response.dto';
import { UserRole } from './enums/user-role.enum';
import {
  FIND_USER_ADMIN_SERVICE,
  IFindUserAdminService,
  IListUsersAdminService,
  LIST_USERS_ADMIN_SERVICE
} from './interfaces/users.interface';
import { ApiAdminGetAllUsers, ApiAdminGetUser } from './users.swagger';

@Controller({
  path: 'admin/users',
  version: '1'
})
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(
    @Inject(LIST_USERS_ADMIN_SERVICE)
    private readonly listUsersAdminService: IListUsersAdminService,
    @Inject(FIND_USER_ADMIN_SERVICE)
    private readonly findUserAdminService: IFindUserAdminService
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiAdminGetAllUsers()
  async getAll(@Query() query: AdminUsersListRequestDto) {
    const { items, nextCursor } = await this.listUsersAdminService.list(
      query.cursor,
      query.limit
    );

    return {
      items: plainToInstance(AdminUserResponseDto, items, {
        excludeExtraneousValues: true
      }),
      nextCursor
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiAdminGetUser()
  @Serialize(AdminUserResponseDto)
  get(
    @Param()
    { id }: IdDto
  ) {
    return this.findUserAdminService.findById(id);
  }
}
