import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    return new Redis({
      host: config.get<string>('REDIS_HOST'),
      port: Number(config.get('REDIS_PORT')),
      password: config.get<string>('REDIS_PASSWORD'),
      db: Number(config.get('REDIS_DB') ?? 0)
    });
  }
};
