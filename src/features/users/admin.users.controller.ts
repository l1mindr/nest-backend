import { IdDto } from '@infrastructure/http/dto/id.dto';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards
} from '@nestjs/common';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AdminUserDto } from './dto/admin-user.dto';
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
  async getAll() {
    const users = await this.usersService.list();
    return users.map((user) => new AdminUserDto(user));
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
