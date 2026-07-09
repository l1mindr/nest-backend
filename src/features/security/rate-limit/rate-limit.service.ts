import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisCounterService } from '@infrastructure/databases/redis/redis-counter.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RateLimitService {
  constructor(private readonly redisCounterService: RedisCounterService) {}

  private buildKey(route: string, ip: string) {
    return `${RedisKey.RATE_LIMIT}:${route}:${ip}`;
  }

  async consume(route: string, ip: string, limit: number, ttl: number) {
    const key = this.buildKey(route, ip);

    const count = await this.redisCounterService.increment(key, ttl);

    return count <= limit;
  }
}
