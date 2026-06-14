import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import jwtConfig from './config/jwt/jwt.config';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      load: [jwtConfig]
    }),
    DatabaseModule
  ]
})
export class InfrastructureModule {}
