import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

@Module({
  providers: [
    RateLimitService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard
    }
  ]
})
export class RateLimitModule {}
