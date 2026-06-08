import { Module } from '@nestjs/common';
import { ClockModule } from './clock/clock.module';
import { CommonModule } from './common/common.module';
import { DeviceModule } from './device/device.module';

@Module({
  imports: [CommonModule, ClockModule, DeviceModule],
  exports: [ClockModule, DeviceModule]
})
export class CoreModule {}
