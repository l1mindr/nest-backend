import { Module } from '@nestjs/common';
import { EnvModule } from './config/env/env.module';
import { DatabasesModule } from './databases/databases.module';

@Module({
  imports: [EnvModule, DatabasesModule]
})
export class InfrastructureModule {}
