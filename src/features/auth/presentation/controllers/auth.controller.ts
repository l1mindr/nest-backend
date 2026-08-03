import { SkipCsrf } from '@features/security/csrf/decorators/skip-csrf.decorator';
import { Public } from '@features/security/decorators/public.decorator';
import { Session } from '@features/security/decorators/session.decorator';
import { User } from '@features/security/decorators/user.decorator';
import { DeviceContext } from '@presentation/interfaces/context/device-context.interface';
import { Device } from '@features/security/device-detection/decorators/device.decorator';
import { RateLimitPolicies } from '@features/security/rate-limit/config/rate-limit.config';
import { RateLimit } from '@features/security/rate-limit/decorators/rate-limit.decorator';
import {
  IResendVerificationUseCase,
  IVerifyEmailUseCase,
  RESEND_VERIFICATION_USE_CASE,
  VERIFY_EMAIL_USE_CASE
} from '@features/users/application/interfaces/users.interface';
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
import { ApiTagName } from '@presentation/swagger/openapi.constants';
import { Request } from 'express';
import {
  ApiChangePassword,
  ApiLoginUser,
  ApiRefreshToken,
  ApiRegisterUser,
  ApiResendVerification,
  ApiVerifyEmail
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
import { ResendVerificationRequestDto } from '../dto/request/resend-verification.request.dto';
import { VerifyEmailRequestDto } from '../dto/request/verify-email.request.dto';
import { AuthCookieInterceptor } from '../interceptors/auth-cookie.interceptor';

@Controller({ path: 'auth', version: '1' })
@ApiTags(ApiTagName.AUTHENTICATION)
export class AuthController {
  constructor(
    @Inject(REGISTER)
    private readonly registerUseCase: IRegister,
    @Inject(LOGIN)
    private readonly loginUseCase: ILogin,
    @Inject(CHANGE_PASSWORD)
    private readonly changePasswordUseCase: IChangePassword,
    @Inject(REFRESH)
    private readonly refreshUseCase: IRefresh,
    @Inject(VERIFY_EMAIL_USE_CASE)
    private readonly verifyEmailUseCase: IVerifyEmailUseCase,
    @Inject(RESEND_VERIFICATION_USE_CASE)
    private readonly resendVerificationUseCase: IResendVerificationUseCase
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(RateLimitPolicies.Auth.Register)
  @SkipCsrf()
  @ApiRegisterUser()
  registerUser(@Body() dto: RegisterUserRequestDto) {
    return this.registerUseCase.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AuthCookieInterceptor)
  @RateLimit(RateLimitPolicies.Auth.Login)
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
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit(RateLimitPolicies.Auth.Verify)
  @SkipCsrf()
  @ApiVerifyEmail()
  async verifyEmail(@Body() dto: VerifyEmailRequestDto): Promise<void> {
    await this.verifyEmailUseCase.execute(dto.email, dto.code);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit(RateLimitPolicies.Auth.Resend)
  @SkipCsrf()
  @ApiResendVerification()
  async resendVerification(
    @Body() dto: ResendVerificationRequestDto
  ): Promise<void> {
    await this.resendVerificationUseCase.execute(dto.email);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AuthCookieInterceptor)
  @RateLimit(RateLimitPolicies.Auth.Refresh)
  @SkipCsrf()
  @ApiRefreshToken()
  async refreshTokens(@Req() req: Request) {
    return await this.refreshUseCase.refresh(req.cookies.refresh_token);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit(RateLimitPolicies.Auth.ChangePassword)
  @ApiChangePassword()
  changeUserPassword(
    @User() user: UserEntity,
    @Session() session: SessionEntity,
    @Body() dto: ChangePasswordRequestDto
  ) {
    return this.changePasswordUseCase.changePassword(user.id, session.id, dto);
  }
}
