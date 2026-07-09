import { Injectable } from '@nestjs/common';
import { RedisLockKey } from './keys/redis-lock-key.enum';
import { RedisService } from './redis.service';

@Injectable()
export class RedisLockService {
  constructor(private readonly redisService: RedisService) {}

  private getFullKey(key: RedisLockKey, value: string) {
    return `${key}:${value}`;
  }

  async acquire(
    lockKey: RedisLockKey,
    lockIdentifier: string,
    ttlSeconds = 5
  ): Promise<boolean> {
    const redisClient = this.redisService as unknown as {
      set(
        key: string,
        value: string,
        mode: 'NX',
        expireMode: 'EX',
        ttl: number
      ): Promise<'OK' | null>;
    };

    return (
      (await redisClient.set(
        this.getFullKey(lockKey, lockIdentifier),
        '1',
        'NX',
        'EX',
        ttlSeconds
      )) === 'OK'
    );
  }

  async release(key: RedisLockKey, value: string) {
    await this.redisService.del(this.getFullKey(key, value));
  }
}
