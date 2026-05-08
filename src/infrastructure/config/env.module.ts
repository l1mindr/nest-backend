import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ENV_VALIDATION_SCHEMA } from './env.constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      validationSchema: ENV_VALIDATION_SCHEMA,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env']
    })
  ]
})
export class EnvModule {}
