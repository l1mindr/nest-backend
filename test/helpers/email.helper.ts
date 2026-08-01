import { EmailService } from '@infrastructure/email/email.service';

interface SentVerification {
  to: string;
  code: string;
  expiresAt: Date;
}

const sentVerifications: SentVerification[] = [];

export function resetEmailStore(): void {
  sentVerifications.length = 0;
}

export function getVerificationCode(to: string): string | undefined {
  const match = [...sentVerifications].reverse().find((mail) => mail.to === to);

  return match?.code;
}

export function getVerificationExpiry(to: string): Date | undefined {
  const match = [...sentVerifications].reverse().find((mail) => mail.to === to);

  return match?.expiresAt;
}

export function getVerificationEmailCount(to: string): number {
  return sentVerifications.filter((mail) => mail.to === to).length;
}

export const capturingEmailService: EmailService = {
  async sendVerificationEmail(email, code, expiresAt) {
    sentVerifications.push({ to: email, code, expiresAt });
  },
  async sendSuspensionEmail() {
    // no-op: suspend/unsuspend flows are covered by unit tests
  },
  async sendUnsuspensionEmail() {
    // no-op
  }
};
