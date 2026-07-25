import { SkipCsrf } from '@features/security/csrf/decorators/skip-csrf.decorator';
import { Public } from '@features/security/decorators/public.decorator';
import { Session } from '@features/security/decorators/session.decorator';
import { User } from '@features/security/decorators/user.decorator';
import { DeviceContext } from '@core/http/device-context.interface';
import { Device } from '@features/security/device-detection/decorators/device.decorator';
import { RateLimit } from '@features/security/rate-limit/decorators/rate-limit.decorator';
import { Session as SessionEntity } from '@features/sessions/entities/session.entity';
import { User as UserEntity } from '@features/users/entities/user.entity';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseInterceptors
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  ApiChangePassword,
  ApiLoginUser,
  ApiRegisterUser
} from './auth.swagger';
import {
  CHANGE_PASSWORD_SERVICE,
  IChangePasswordService,
  ILoginUserService,
  IRefreshTokenService,
  IRegisterUserService,
  LOGIN_USER_SERVICE,
  REFRESH_TOKEN_SERVICE,
  REGISTER_USER_SERVICE
} from './interfaces/auth.interface';
import { IpAddress } from './decorators/ipAddress.decorator';
import { ChangePasswordRequestDto } from './dto/request/change-password.request.dto';
import { LoginUserRequestDto } from './dto/request/login-user.request.dto';
import { RegisterUserRequestDto } from './dto/request/register-user.request.dto';
import { AuthCookieInterceptor } from './interceptors/auth-cookie.interceptor';

@Controller({ path: 'auth', version: '1' })
@ApiTags('auth')
export class AuthController {
  constructor(
    @Inject(REGISTER_USER_SERVICE)
    private readonly registerUserService: IRegisterUserService,
    @Inject(LOGIN_USER_SERVICE)
    private readonly loginUserService: ILoginUserService,
    @Inject(CHANGE_PASSWORD_SERVICE)
    private readonly changePasswordService: IChangePasswordService,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokenService: IRefreshTokenService
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({ limit: 5, ttl: 60 })
  @SkipCsrf()
  @ApiRegisterUser()
  registerUser(@Body() dto: RegisterUserRequestDto) {
    return this.registerUserService.registerUser(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AuthCookieInterceptor)
  @RateLimit({ limit: 5, ttl: 60 })
  @SkipCsrf()
  @ApiLoginUser()
  async loginUser(
    @Body() dto: LoginUserRequestDto,
    @IpAddress() ipAddress: string,
    @Device() device: DeviceContext
  ) {
    return await this.loginUserService.loginUser(dto, ipAddress, device);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AuthCookieInterceptor)
  @RateLimit({ limit: 20, ttl: 60 })
  @SkipCsrf()
  @ApiLoginUser()
  async refreshTokens(@Req() req: Request) {
    return await this.refreshTokenService.refreshTokens(
      req.cookies.refresh_token
    );
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({
    limit: 3,
    ttl: 300
  })
  @ApiChangePassword()
  changeUserPassword(
    @User() user: UserEntity,
    @Session() session: SessionEntity,
    @Body() dto: ChangePasswordRequestDto
  ) {
    return this.changePasswordService.changeUserPassword(
      user.id,
      session.id,
      dto
    );
  }
}
