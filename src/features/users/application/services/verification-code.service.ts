import { TimeConstants } from '@infrastructure/clock/time.constants';
import { ClockService } from '@infrastructure/clock/clock.service';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

@Injectable()
export class VerificationCodeService {
  constructor(private readonly clockService: ClockService) {}

  generate(): string {
    return randomInt(100_000, 1_000_000).toString();
  }

  async hash(code: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(code, salt);
  }

  async validate(code: string, codeHash: string): Promise<boolean> {
    return bcrypt.compare(code, codeHash);
  }

  isExpired(createdAt: Date): boolean {
    const expiresAt = new Date(
      createdAt.getTime() + 3 * TimeConstants.MS_PER_MINUTE
    );
    return this.clockService.nowDate() > expiresAt;
  }
}
