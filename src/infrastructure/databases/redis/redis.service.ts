import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis, { RedisKey } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis
  ) {}

  get client() {
    return this.redis;
  }

  async set(key: RedisKey, value: string | number | Buffer): Promise<'OK'> {
    return this.redis.set(key, value);
  }

  async setWithExpiry(
    key: RedisKey,
    value: string | number | Buffer,
    ttlSeconds: number
  ): Promise<'OK'> {
    return this.redis.set(key, value, 'EX', ttlSeconds);
  }

  async del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  async get(key: string) {
    return this.redis.get(key);
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
