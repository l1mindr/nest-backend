import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class RedisCounterService {
  constructor(private readonly redisService: RedisService) {}

  async get(key: string) {
    return this.redisService.get(key);
  }

  async increment(key: string, ttl?: number) {
    const value = await this.redisService.client.incr(key);

    if (value === 1 && ttl) {
      await this.redisService.client.expire(key, ttl);
    }

    return value;
  }
}
