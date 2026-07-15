import redisConfig from '@infrastructure/config/databases/redis.config';
import jwtConfig from '@infrastructure/config/jsonwebtoken/jwt.config';
import csrfConfig from '@infrastructure/config/security/csrf.config';
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
      load: [jwtConfig, redisConfig, csrfConfig]
    })
  ]
})
export class EnvModule {}
