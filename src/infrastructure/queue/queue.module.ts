import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import redisConfig from '../config/databases/redis.config';
import { EmailQueueModule } from './email/email-queue.module';
import queueConfig from './queue.config';

/**
 * Owns the BullMQ connection every queue in the project shares.
 *
 * BullMQ opens its own Redis clients rather than reusing `REDIS_CLIENT`: a
 * worker holds a connection blocked on `BZPOPMIN` while it waits for jobs, and
 * lending it to the rate limiter or the lock service would stall them behind
 * that block.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [redisConfig.KEY, queueConfig.KEY],
      useFactory: (
        redis: ConfigType<typeof redisConfig>,
        queue: ConfigType<typeof queueConfig>
      ) => ({
        connection: {
          host: redis.host,
          port: redis.port,
          password: redis.password,
          db: redis.db,
          // Required by BullMQ: a blocking read must be allowed to outlive the
          // default retry budget, and BullMQ refuses to start a worker without
          // it rather than failing later under load.
          maxRetriesPerRequest: null
        },
        prefix: queue.prefix
      })
    }),
    EmailQueueModule
  ]
})
export class QueueModule {}
