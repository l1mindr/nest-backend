import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email.service';

@Injectable()
export class ConsoleEmailService extends EmailService {
  private readonly logger = new Logger(ConsoleEmailService.name);

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    this.logger.log(`[EMAIL] Verification code for ${email}: ${code}`);
  }
}
