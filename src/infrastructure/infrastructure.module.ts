import { Module } from '@nestjs/common';
import { DatabasesModule } from './databases/databases.module';
import { EnvModule } from './config/env/env.module';

@Module({
  imports: [EnvModule, DatabasesModule]
})
export class InfrastructureModule {}
