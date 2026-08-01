import { EmailService } from '@infrastructure/email/email.service';

interface SentVerification {
  to: string;
  code: string;
  expiresInMinutes: number;
}

const sentVerifications: SentVerification[] = [];

export function resetEmailStore(): void {
  sentVerifications.length = 0;
}

export function getVerificationCode(to: string): string | undefined {
  const match = [...sentVerifications].reverse().find((mail) => mail.to === to);

  return match?.code;
}

export function getVerificationTtlMinutes(to: string): number | undefined {
  const match = [...sentVerifications].reverse().find((mail) => mail.to === to);

  return match?.expiresInMinutes;
}

export function getVerificationEmailCount(to: string): number {
  return sentVerifications.filter((mail) => mail.to === to).length;
}

export const capturingEmailService: EmailService = {
  async sendVerificationEmail(email, code, expiresInMinutes) {
    sentVerifications.push({ to: email, code, expiresInMinutes });
  },
  async sendSuspensionEmail() {
    // no-op: suspend/unsuspend flows are covered by unit tests
  },
  async sendUnsuspensionEmail() {
    // no-op
  }
};
