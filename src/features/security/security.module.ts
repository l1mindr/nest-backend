import { TokenModule } from '@features/token/token.module';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { CsrfModule } from './csrf/csrf.module';
import { CsrfGuard } from './csrf/guards/csrf.guard';
import { DeviceDetectionModule } from './device-detection/device-detection.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { JwtGuard } from './guards/jwt.guard';
import { RolesGuard } from './guards/roles.guard';
import { RateLimitGuard } from './rate-limit/guards/rate-limit.guard';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    JwtModule,
    TokenModule,
    DeviceDetectionModule,
    RateLimitModule,
    CsrfModule
  ],
  providers: [
    JwtStrategy,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter
    },
    {
      provide: APP_GUARD,
      useClass: JwtGuard
    },
    // Rate limiting runs immediately after authentication: `req.user` and
    // `req.session` are populated for the identity dimensions, and an exhausted
    // budget is rejected before any role or CSRF work is done. Declaring the
    // order here rather than letting it emerge from module resolution keeps it
    // explicit; `useExisting` aliases the single instance the rate-limit module
    // provides.
    {
      provide: APP_GUARD,
      useExisting: RateLimitGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard
    }
  ],
  exports: [DeviceDetectionModule]
})
export class SecurityModule {}
