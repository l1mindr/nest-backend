import { Logger, Provider } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import redisConfig from '../../config/databases/redis.config';
import { REDIS_CLIENT } from './redis.constants';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [redisConfig.KEY],
  useFactory: (config: ConfigType<typeof redisConfig>) => {
    const logger = new Logger('Redis');

    const client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db
    });

    client.on('error', (err) => {
      logger.error('Redis connection error', err.stack);
    });

    return client;
  }
};
