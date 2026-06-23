import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisLockService } from './redis-lock.service';
import { redisProvider } from './redis.provider';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [redisProvider, RedisService, RedisLockService],
  exports: [RedisLockService]
})
export class RedisModule {}
