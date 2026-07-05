import { Module } from '@nestjs/common';
import { ClockModule } from './clock/clock.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [CommonModule, ClockModule],
  exports: [ClockModule]
})
export class CoreModule {}
