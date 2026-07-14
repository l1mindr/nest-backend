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
  UseGuards
} from '@nestjs/common';
import { AdminUserResponseDto } from './dto/response/admin-user.response.dto';
import { UserRole } from './enums/user-role.enum';
import { IUsersService, USER_SERVICE } from './interfaces/users.interface';
import { ApiAdminGetAllUsers, ApiAdminGetUser } from './users.swagger';

@Controller({
  path: 'admin/users',
  version: '1'
})
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(
    @Inject(USER_SERVICE)
    private readonly usersService: IUsersService
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiAdminGetAllUsers()
  @Serialize(AdminUserResponseDto)
  async getAll() {
    return await this.usersService.list();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiAdminGetUser()
  get(
    @Param()
    { id }: IdDto
  ) {
    return this.usersService.findById(id);
  }
}
