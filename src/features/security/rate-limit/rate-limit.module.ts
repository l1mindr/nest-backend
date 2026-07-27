import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RateLimitCheckService } from './services/rate-limit-check.service';
import { RateLimitCounterService } from './services/rate-limit-counter.service';

@Module({
  providers: [
    RateLimitCounterService,
    RateLimitCheckService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard
    }
  ]
})
export class RateLimitModule {}
