import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
  ): Promise<string | null> {
    const token = randomUUID();

    const result = await this.redisService.setIfNotExistsWithExpiry(
      this.getFullKey(lockKey, lockIdentifier),
      token,
      ttlSeconds
    );

    return result === 'OK' ? token : null;
  }

  async release(
    lockKey: RedisKey,
    lockIdentifier: string,
    token: string
  ): Promise<boolean> {
    const released = await this.redisService.compareAndDelete(
      this.getFullKey(lockKey, lockIdentifier),
      token
    );

    return released === 1;
  }
}
