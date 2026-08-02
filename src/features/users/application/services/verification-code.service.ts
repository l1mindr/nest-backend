import { ClockService } from '@infrastructure/clock/clock.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

@Injectable()
export class VerificationCodeService {
  private readonly rounds: number;

  constructor(
    private readonly clockService: ClockService,
    configService: ConfigService
  ) {
    this.rounds = configService.get<number>('BCRYPT_ROUNDS') ?? 10;
  }

  generate(): string {
    return randomInt(100_000, 1_000_000).toString();
  }

  async hash(code: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.rounds);
    return bcrypt.hash(code, salt);
  }

  async validate(code: string, codeHash: string): Promise<boolean> {
    return bcrypt.compare(code, codeHash);
  }

  isExpired(expiresAt: Date): boolean {
    return this.clockService.nowDate() > expiresAt;
  }
}
