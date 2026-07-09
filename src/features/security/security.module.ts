import { TokenModule } from '@features/token/token.module';
import jwtConfig from '@infrastructure/config/jsonwebtoken/jwt.config';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { DeviceDetectionModule } from './device-detection/device-detection.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { JwtGuard } from './guards/jwt.guard';
import { RolesGuard } from './guards/roles.guard';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    JwtModule.registerAsync(jwtConfig.asProvider()),
    TokenModule,
    DeviceDetectionModule,
    RateLimitModule
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
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    }
  ],
  exports: [DeviceDetectionModule]
})
export class SecurityModule {}
