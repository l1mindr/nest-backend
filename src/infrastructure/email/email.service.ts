import { Injectable } from '@nestjs/common';
import { PriceAlertDirection } from './email.message';

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

  abstract sendPriceAlertEmail(
    email: string,
    alert: PriceAlertEmailContent
  ): Promise<void>;
}

/**
 * Grouped rather than passed as five positional arguments, which at this arity
 * would be five interchangeable strings at the call site.
 */
export interface PriceAlertEmailContent {
  coinName: string;
  coinSymbol: string;
  direction: PriceAlertDirection;
  targetPrice: string;
  currentPrice: string;
  triggeredAt: Date;
}
