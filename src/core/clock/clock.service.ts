import { Injectable } from '@nestjs/common';
import { TimeConstants } from './time.constants';

@Injectable()
export class ClockService {
  nowMs(): number {
    return Date.now();
  }

  createAuthTimestamps() {
    const now = this.nowMs();

    return {
      now,
      expiresAt: new Date(now + TimeConstants.MS_PER_DAY)
    };
  }
}
