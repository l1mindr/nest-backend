import { EmailService } from '@infrastructure/email/email.service';
import {
  EmailMessage,
  EmailMessageType
} from '@infrastructure/email/email.message';
import { EmailPublisher } from '@infrastructure/email/email.publisher';

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

/**
 * The queue is deliberately bypassed in E2E: delivery runs on the BullMQ
 * worker, which resolves asynchronously, while specs read the mailbox
 * synchronously right after a request returns. Publishing through this fake
 * records the message the same way the queue's EmailProcessor would, so the
 * queue's own asynchronous delivery is left to its unit tests.
 */
export const capturingEmailPublisher: EmailPublisher = {
  async publish(message: EmailMessage): Promise<void> {
    switch (message.type) {
      case EmailMessageType.VERIFICATION:
        await capturingEmailService.sendVerificationEmail(
          message.to,
          message.data.code,
          message.data.expiresInMinutes
        );
        return;

      case EmailMessageType.ADMIN_INVITATION:
        await capturingEmailService.sendAdminInvitationEmail(
          message.to,
          message.data.token,
          message.data.expiresInHours
        );
        return;

      case EmailMessageType.SUSPENSION:
        await capturingEmailService.sendSuspensionEmail(
          message.to,
          message.data.displayName,
          message.data.reason,
          new Date(message.data.suspendedAt)
        );
        return;

      case EmailMessageType.UNSUSPENSION:
        await capturingEmailService.sendUnsuspensionEmail(
          message.to,
          message.data.displayName,
          new Date(message.data.unsuspendedAt)
        );
    }
  }
};
