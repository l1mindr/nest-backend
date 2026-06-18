import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import jwtConfig from './config/jwt/jwt.config';
import { DatabaseModule } from './database/database.module';
import redisConfig from './redis/config/redis.config';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      load: [jwtConfig, redisConfig]
    }),
    DatabaseModule,
    RedisModule
  ]
})
export class InfrastructureModule {}
