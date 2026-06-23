import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
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

  async set(...args: Parameters<Redis['set']>) {
    return this.redis.set(...args);
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
