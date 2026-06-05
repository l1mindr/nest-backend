import { Injectable } from '@nestjs/common';
import { TimeConstants } from './time.constants';

@Injectable()
export class ClockService {
  nowMs(): number {
    return Date.now();
  }

  addDaysFrom(ms: number, days: number): Date {
    return new Date(ms + days * TimeConstants.MS_PER_DAY);
  }

  snapshot() {
    const now = this.nowMs();

    return {
      now,
      expiresAt: this.addDaysFrom(now, 7)
    };
  }
}
