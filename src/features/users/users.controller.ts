import { User } from '@features/auth/decorators/user.decorator';
import { User as UserEntity } from '@features/users/entities/user.entity';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Put
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  ApiChangeProfile,
  ApiDeleteAccount,
  ApiGetProfile
} from './users.swagger';
import { Serialize } from '@core/common/decorators/serialize.decorator';
import { UserProfileResponseDto } from './dto/response/user-profile.response.dto';
import { UpdateUserRequestDto } from './dto/request/update-user.request.dto';

@Controller({
  path: 'user',
  version: '1'
})
@ApiTags('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiGetProfile()
  @Serialize(UserProfileResponseDto)
  getProfile(@User('user') user: UserEntity) {
    return user;
  }

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiChangeProfile()
  changeProfile(
    @User('user') user: UserEntity,
    @Body() dto: UpdateUserRequestDto
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Delete('delete-account')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteAccount()
  deleteAccount(@User('user') user: UserEntity) {
    return this.usersService.requestAccountDeletion(user.id);
  }
}
