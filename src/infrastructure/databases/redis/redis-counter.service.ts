import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class RedisCounterService {
  private static readonly INCREMENT_WITH_TTL_SCRIPT = `
    local current = redis.call("incr", KEYS[1])
    if current == 1 then
      redis.call("expire", KEYS[1], tonumber(ARGV[1]))
    end
    return current
  `;

  constructor(private readonly redisService: RedisService) {}

  async get(key: string) {
    return this.redisService.get(key);
  }

  async increment(key: string, ttl: number) {
    if (ttl <= 0) {
      throw new Error('TTL must be a positive number');
    }

    const result = await this.redisService.eval(
      RedisCounterService.INCREMENT_WITH_TTL_SCRIPT,
      [key],
      ttl
    );

    return Number(result);
  }
}
