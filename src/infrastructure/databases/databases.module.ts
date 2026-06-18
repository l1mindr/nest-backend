import { Module } from '@nestjs/common';
import { PostgresModule } from './postgres/postgres.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [PostgresModule, RedisModule]
})
export class DatabasesModule {}
