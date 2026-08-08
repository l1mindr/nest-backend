import { Module } from '@nestjs/common';
import { EnvModule } from './config/env/env.module';
import { DatabasesModule } from './databases/databases.module';
import { ClockModule } from './clock/clock.module';
import { EmailModule } from './email/email.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    EnvModule,
    DatabasesModule,
    ClockModule,
    EmailModule,
    // Registered after EmailModule: the email worker delivers through the
    // provider that module exports.
    QueueModule
  ]
})
export class InfrastructureModule {}
