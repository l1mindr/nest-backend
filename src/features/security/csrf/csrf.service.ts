import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class CsrfService {
  generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  validate(cookieToken?: string, headerToken?: string) {
    return !!cookieToken && cookieToken === headerToken;
  }
}
