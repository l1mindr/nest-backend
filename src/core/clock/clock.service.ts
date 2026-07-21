import { Injectable } from '@nestjs/common';
import { TimeConstants } from './time.constants';

@Injectable()
export class ClockService {
  nowMs(): number {
    return Date.now();
  }

  nowDate(): Date {
    return this.dateFromMs(this.nowMs());
  }

  dateFromMs(ms: number): Date {
    return new Date(ms);
  }

  addDaysFrom(ms: number, days: number): Date {
    return this.dateFromMs(ms + days * TimeConstants.MS_PER_DAY);
  }

  snapshot() {
    const now = this.nowMs();

    return {
      now,
      expiresAt: this.addDaysFrom(now, 7)
    };
  }
}
