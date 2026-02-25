import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IDevice } from '@features/sessions/interfaces/device.interface';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { AuthService } from './auth.service';
import {
  ApiChangePassword,
  ApiLoginUser,
  ApiRegisterUser
} from './auth.swagger';
import { IpAddress } from './decorators/ipAddress.decorator';
import { Public } from './decorators/public.decorator';
import { User } from './decorators/user.decorator';
import { UserAgent } from './decorators/userAgent.decorator';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { AuthCookieInterceptor } from './interceptors/auth-cookie.interceptor';

@Controller({ path: 'auth', version: '1' })
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiRegisterUser()
  signUpUser(@Body() registerUserDto: RegisterUserDto) {
    return this.authService.registerUser(registerUserDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AuthCookieInterceptor)
  @ApiLoginUser()
  async signInUser(
    @Body() loginUserDto: LoginUserDto,
    @IpAddress() ip: string,
    @UserAgent() device: IDevice
  ) {
    return await this.authService.loginUser(loginUserDto, ip, device);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiChangePassword()
  changePassword(
    @User() authData: CustomAuth,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.authService.changeUserPassword(authData, changePasswordDto);
  }
}
