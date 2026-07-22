import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class RedisCounterService {
  private static readonly INCREMENT_WITH_TTL_SCRIPT = `
    local current = redis.call("incr", KEYS[1])
    if current == 1 then
      local ttl = tonumber(ARGV[1])
      if ttl then
        redis.call("expire", KEYS[1], ttl)
      end
    end
    return current
  `;

  constructor(private readonly redisService: RedisService) {}

  async get(key: string) {
    return this.redisService.get(key);
  }

  async increment(key: string, ttl?: number) {
    const result = await this.redisService.eval(
      RedisCounterService.INCREMENT_WITH_TTL_SCRIPT,
      [key],
      ttl ?? ''
    );

    return Number(result);
  }
}
