import { User } from '@features/security/decorators/user.decorator';
import { User as UserEntity } from '@features/users/entities/user.entity';
import { Serialize } from '@infrastructure/http/interceptors/decorators/serialize.decorator';
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
import { UpdateUserRequestDto } from './dto/request/update-user.request.dto';
import { UserProfileResponseDto } from './dto/response/user-profile.response.dto';
import { UsersService } from './users.service';
import {
  ApiChangeProfile,
  ApiDeleteAccount,
  ApiGetProfile
} from './users.swagger';

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
  getProfile(@User() user: UserEntity) {
    return user;
  }

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiChangeProfile()
  changeProfile(@User() user: UserEntity, @Body() dto: UpdateUserRequestDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Delete('delete-account')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteAccount()
  deleteAccount(@User() user: UserEntity) {
    return this.usersService.requestAccountDeletion(user.id);
  }
}
