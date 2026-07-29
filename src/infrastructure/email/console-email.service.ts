import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email.service';

@Injectable()
export class ConsoleEmailService extends EmailService {
  private readonly logger = new Logger(ConsoleEmailService.name);

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    this.logger.log(`[EMAIL] Verification code for ${email}: ${code}`);
  }

  async sendSuspensionEmail(
    email: string,
    displayName: string | null,
    reason: string,
    suspendedAt: Date
  ): Promise<void> {
    const name = displayName ?? email;
    this.logger.log(
      `[EMAIL] Account suspended for ${name} (${email}): ${reason} at ${suspendedAt.toISOString()}`
    );
  }
}
