import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis, { RedisKey } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private static readonly COMPARE_AND_DELETE_SCRIPT = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

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

  async setIfNotExists(
    key: RedisKey,
    value: string | number | Buffer
  ): Promise<'OK' | null> {
    return await this.redis.set(key, value, 'NX');
  }

  async setIfNotExistsWithExpiry(
    key: RedisKey,
    value: string | number | Buffer,
    ttlSeconds: number
  ): Promise<'OK' | null> {
    return await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
  }

  async setWithExpiry(
    key: RedisKey,
    value: string | number | Buffer,
    ttlSeconds: number
  ): Promise<'OK' | null> {
    return await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
  }

  async del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  async compareAndDelete(key: string, value: string): Promise<number> {
    const result = await this.redis.eval(
      RedisService.COMPARE_AND_DELETE_SCRIPT,
      1,
      key,
      value
    );

    return Number(result);
  }

  async get(key: string) {
    return this.redis.get(key);
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
