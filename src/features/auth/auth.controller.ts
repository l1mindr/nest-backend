import { DeviceContext } from '@features/security/device-detection/context/device-context.interface';
import { Device } from '@features/security/device-detection/decorators/device.decorator';
import { Public } from '@features/security/decorators/public.decorator';
import { Session } from '@features/security/decorators/session.decorator';
import { User } from '@features/security/decorators/user.decorator';
import { Session as SessionEntity } from '@features/sessions/entities/session.entity';
import { User as UserEntity } from '@features/users/entities/user.entity';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseInterceptors
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  ApiChangePassword,
  ApiLoginUser,
  ApiRegisterUser
} from './auth.swagger';
import { IpAddress } from './decorators/ipAddress.decorator';
import { ChangePasswordRequestDto } from './dto/request/change-password.request.dto';
import { LoginUserRequestDto } from './dto/request/login-user.request.dto';
import { RegisterUserRequestDto } from './dto/request/register-user.request.dto';
import { AuthCookieInterceptor } from './interceptors/auth-cookie.interceptor';

@Controller({ path: 'auth', version: '1' })
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiRegisterUser()
  signUpUser(@Body() dto: RegisterUserRequestDto) {
    return this.authService.registerUser(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AuthCookieInterceptor)
  @ApiLoginUser()
  async signInUser(
    @Body() dto: LoginUserRequestDto,
    @IpAddress() ipAddress: string,
    @Device() device: DeviceContext
  ) {
    return await this.authService.loginUser(dto, ipAddress, device);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AuthCookieInterceptor)
  @ApiLoginUser()
  async refreshSession(@Req() req: Request) {
    return await this.authService.refresh(req.cookies.refresh_token);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiChangePassword()
  changePassword(
    @User() user: UserEntity,
    @Session() session: SessionEntity,

    @Body() dto: ChangePasswordRequestDto
  ) {
    return this.authService.changeUserPassword(user.id, session.id, dto);
  }
}
