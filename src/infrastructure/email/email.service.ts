import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class EmailService {
  abstract sendVerificationEmail(email: string, code: string): Promise<void>;
}
