import { SkipCsrf } from '@features/security/csrf/decorators/skip-csrf.decorator';
import { Public } from '@features/security/decorators/public.decorator';
import { Session } from '@features/security/decorators/session.decorator';
import { User } from '@features/security/decorators/user.decorator';
import { DeviceContext } from '@presentation/interfaces/context/device-context.interface';
import { Device } from '@features/security/device-detection/decorators/device.decorator';
import { RateLimit } from '@features/security/rate-limit/decorators/rate-limit.decorator';
import { Session as SessionEntity } from '@features/sessions/domain/entities/session.entity';
import { User as UserEntity } from '@features/users/domain/entities/user.entity';
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
  ApiRefreshToken,
  ApiRegisterUser
} from '../swagger/auth.swagger';
import {
  CHANGE_PASSWORD,
  IChangePassword,
  ILogin,
  IRefresh,
  IRegister,
  LOGIN,
  REFRESH,
  REGISTER
} from '../../application/interfaces/auth.interface';
import { IpAddress } from '../decorators/ip-address.decorator';
import { ChangePasswordRequestDto } from '../dto/request/change-password.request.dto';
import { LoginUserRequestDto } from '../dto/request/login-user.request.dto';
import { RegisterUserRequestDto } from '../dto/request/register-user.request.dto';
import { AuthCookieInterceptor } from '../interceptors/auth-cookie.interceptor';

@Controller({ path: 'auth', version: '1' })
@ApiTags('auth')
export class AuthController {
  constructor(
    @Inject(REGISTER)
    private readonly registerUseCase: IRegister,
    @Inject(LOGIN)
    private readonly loginUseCase: ILogin,
    @Inject(CHANGE_PASSWORD)
    private readonly changePasswordUseCase: IChangePassword,
    @Inject(REFRESH)
    private readonly refreshUseCase: IRefresh
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({ limit: 5, ttl: 60 })
  @SkipCsrf()
  @ApiRegisterUser()
  registerUser(@Body() dto: RegisterUserRequestDto) {
    return this.registerUseCase.register(dto);
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
    return await this.loginUseCase.login(dto, ipAddress, device);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AuthCookieInterceptor)
  @RateLimit({ limit: 20, ttl: 60 })
  @SkipCsrf()
  @ApiRefreshToken()
  async refreshTokens(@Req() req: Request) {
    return await this.refreshUseCase.refresh(req.cookies.refresh_token);
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
    return this.changePasswordUseCase.changePassword(user.id, session.id, dto);
  }
}
