import { Public } from '@features/security/decorators/public.decorator';
import { IUserAgent } from '@features/sessions/interfaces/user-agent.interface';
import { CustomAuth } from '@infrastructure/http/interfaces/custom-request.interface';
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
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { AuthService } from './auth.service';
import {
  ApiChangePassword,
  ApiLoginUser,
  ApiRegisterUser
} from './auth.swagger';
import { IpAddress } from './decorators/ipAddress.decorator';
import { User } from './decorators/user.decorator';
import { UserAgent } from './decorators/userAgent.decorator';
import { RegisterUserRequestDto } from './dto/request/register-user.request.dto';
import { AuthCookieInterceptor } from './interceptors/auth-cookie.interceptor';
import { LoginUserRequestDto } from './dto/request/login-user.request.dto';

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
    @UserAgent() userAgent: IUserAgent
  ) {
    return await this.authService.loginUser(dto, ipAddress, userAgent);
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
    @User() authData: CustomAuth,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.authService.changeUserPassword(authData, changePasswordDto);
  }
}
