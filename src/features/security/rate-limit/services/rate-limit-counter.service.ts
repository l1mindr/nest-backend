import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisCounterService } from '@infrastructure/databases/redis/redis-counter.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RateLimitCounterService {
  constructor(private readonly redisCounterService: RedisCounterService) {}

  private buildKey(route: string, ip: string) {
    return `${RedisKey.RATE_LIMIT}:${route}:${ip}`;
  }

  async increment(route: string, ip: string, ttl: number): Promise<number> {
    const key = this.buildKey(route, ip);

    return this.redisCounterService.increment(key, ttl);
  }
}
