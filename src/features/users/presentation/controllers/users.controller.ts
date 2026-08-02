import { User } from '@features/security/decorators/user.decorator';
import { User as UserEntity } from '@features/users/domain/entities/user.entity';
import { Serialize } from '@presentation/interceptors/decorators/serialize.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Put
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { UpdateProfileRequestDto } from '../dto/request/update-profile.request.dto';
import { UserProfileResponseDto } from '../dto/response/user-profile.response.dto';
import {
  DELETE_ACCOUNT_USE_CASE,
  IDeleteAccountUseCase,
  IUpdateProfileUseCase,
  UPDATE_PROFILE_USE_CASE
} from '../../application/interfaces/users.interface';
import {
  ApiChangeProfile,
  ApiDeleteAccount,
  ApiGetProfile
} from '../swagger/users.swagger';

@Controller({
  path: 'user',
  version: '1'
})
@ApiTags(ApiTagName.USER_PROFILE)
export class UsersController {
  constructor(
    @Inject(UPDATE_PROFILE_USE_CASE)
    private readonly updateProfileUseCase: IUpdateProfileUseCase,
    @Inject(DELETE_ACCOUNT_USE_CASE)
    private readonly deleteAccountUseCase: IDeleteAccountUseCase
  ) {}

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
  changeProfile(
    @User() user: UserEntity,
    @Body() dto: UpdateProfileRequestDto
  ) {
    return this.updateProfileUseCase.execute(user.id, dto);
  }

  @Delete('delete-account')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiDeleteAccount()
  deleteAccount(@User() user: UserEntity) {
    return this.deleteAccountUseCase.execute(user.id);
  }
}
