import { Serialize } from '@core/common/decorators/serialize.decorator';
import { Roles } from '@features/security/decorators/roles.decorator';
import { RolesGuard } from '@features/security/guards/roles.guard';
import { IdDto } from '@infrastructure/http/dto/id.dto';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards
} from '@nestjs/common';
import { AdminUserResponseDto } from './dto/response/admin-user.response.dto';
import { UserRole } from './enums/user-role.enum';
import { UsersService } from './users.service';
import { ApiAdminGetAllUsers, ApiAdminGetUser } from './users.swagger';

@Controller({
  path: 'admin/users',
  version: '1'
})
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

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
