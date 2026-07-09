import { Injectable } from '@nestjs/common';
import { RedisKey } from './keys/redis-key.enum';
import { RedisService } from './redis.service';

@Injectable()
export class RedisLockService {
  constructor(private readonly redisService: RedisService) {}

  private getFullKey(key: RedisKey, value: string) {
    return `${key}:${value}`;
  }

  async acquire(
    lockKey: RedisKey,
    lockIdentifier: string,
    ttlSeconds = 5
  ): Promise<boolean> {
    return (
      (await this.redisService.setWithExpiry(
        this.getFullKey(lockKey, lockIdentifier),
        '1',
        ttlSeconds
      )) === 'OK'
    );
  }

  async release(key: RedisKey, value: string) {
    await this.redisService.del(this.getFullKey(key, value));
  }
}
