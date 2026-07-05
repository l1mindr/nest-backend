import jwtConfig from '@infrastructure/config/jwt.config';
import redisConfig from '@infrastructure/config/redis.config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ENV_VALIDATION_SCHEMA } from './env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validationSchema: ENV_VALIDATION_SCHEMA,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      load: [jwtConfig, redisConfig]
    })
  ]
})
export class EnvModule {}
