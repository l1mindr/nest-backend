import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class EmailService {
  abstract sendVerificationEmail(
    email: string,
    code: string,
    expiresInMinutes: number
  ): Promise<void>;

  /**
   * Delivers the administrator invitation token. The token is passed in plain
   * because the mailbox is the only place it is ever meant to exist — the
   * server keeps nothing but its digest.
   */
  abstract sendAdminInvitationEmail(
    email: string,
    token: string,
    expiresInHours: number
  ): Promise<void>;

  abstract sendSuspensionEmail(
    email: string,
    displayName: string | null,
    reason: string,
    suspendedAt: Date
  ): Promise<void>;

  abstract sendUnsuspensionEmail(
    email: string,
    displayName: string | null,
    unsuspendedAt: Date
  ): Promise<void>;
}
