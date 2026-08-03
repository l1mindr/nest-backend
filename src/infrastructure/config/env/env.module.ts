import redisConfig from '@infrastructure/config/databases/redis.config';
import emailConfig from '@infrastructure/email/email.config';
import jwtConfig from '@infrastructure/config/jsonwebtoken/jwt.config';
import csrfConfig from '@infrastructure/config/security/csrf.config';
import securityConfig from '@infrastructure/config/security/security.config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NODE_ENV } from './env.constants';
import { ENV_VALIDATION_SCHEMA } from './env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validationSchema: ENV_VALIDATION_SCHEMA,
      envFilePath: [`.env.${NODE_ENV}`, '.env'],
      load: [jwtConfig, redisConfig, csrfConfig, securityConfig, emailConfig]
    })
  ]
})
export class EnvModule {}
