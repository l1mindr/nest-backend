import { Module } from '@nestjs/common';
import { DatabasesModule } from './databases/databases.module';

@Module({
  imports: [DatabasesModule]
})
export class InfrastructureModule {}
