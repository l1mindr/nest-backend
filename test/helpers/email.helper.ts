import { EmailService } from '@infrastructure/email/email.service';

interface SentVerification {
  to: string;
  code: string;
  expiresInMinutes: number;
}

interface SentInvitation {
  to: string;
  token: string;
  expiresInHours: number;
}

const sentVerifications: SentVerification[] = [];
const sentInvitations: SentInvitation[] = [];

export function resetEmailStore(): void {
  sentVerifications.length = 0;
  sentInvitations.length = 0;
}

/**
 * The invitation token exists only in the delivered email, so this is the only
 * way a test can obtain one — the same position a real invitee is in.
 */
export function getInvitationToken(to: string): string | undefined {
  return [...sentInvitations].reverse().find((mail) => mail.to === to)?.token;
}

export function getInvitationTtlHours(to: string): number | undefined {
  return [...sentInvitations].reverse().find((mail) => mail.to === to)
    ?.expiresInHours;
}

export function getInvitationEmailCount(to: string): number {
  return sentInvitations.filter((mail) => mail.to === to).length;
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
  async sendAdminInvitationEmail(email, token, expiresInHours) {
    sentInvitations.push({ to: email, token, expiresInHours });
  },
  async sendSuspensionEmail() {
    // no-op: suspend/unsuspend flows are covered by unit tests
  },
  async sendUnsuspensionEmail() {
    // no-op
  }
};
