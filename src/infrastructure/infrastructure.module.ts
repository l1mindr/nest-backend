import { Module } from '@nestjs/common';
import { EnvModule } from './config/env/env.module';
import { DatabasesModule } from './databases/databases.module';
import { ClockModule } from './clock/clock.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [EnvModule, DatabasesModule, ClockModule, EmailModule]
})
export class InfrastructureModule {}
