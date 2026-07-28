import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

@Injectable()
export class RefreshTokenHasher {
  hash(refreshToken: string): string {
    return this.digest(refreshToken).toString('hex');
  }

  compare(refreshToken: string, storedHash: string): boolean {
    const expected = this.digest(refreshToken);
    const stored = Buffer.from(storedHash, 'hex');

    if (stored.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(expected, stored);
  }

  private digest(refreshToken: string): Buffer {
    return createHash('sha256').update(refreshToken).digest();
  }
}
