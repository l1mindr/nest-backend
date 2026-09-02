import { EmailService, PriceAlertEmailContent } from './email.service';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Transporter } from 'nodemailer';
import emailConfig from './email.config';
import { EMAIL_TRANSPORT } from './email.constants';
import {
  buildAdminInvitationEmail,
  buildPriceAlertEmail,
  buildSuspensionEmail,
  buildUnsuspensionEmail,
  buildVerificationEmail
} from './email.template';

interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class SmtpEmailService extends EmailService {
  private readonly from: string;
  private readonly projectName: string;

  constructor(
    @Inject(EMAIL_TRANSPORT) private readonly transport: Transporter,
    @Inject(emailConfig.KEY) config: ConfigType<typeof emailConfig>
  ) {
    super();
    this.from = config.from;
    this.projectName = config.appName;
  }

  async sendVerificationEmail(
    email: string,
    code: string,
    expiresInMinutes: number
  ): Promise<void> {
    const rendered = buildVerificationEmail({
      projectName: this.projectName,
      code,
      expiresInMinutes
    });

    await this.send({ to: email, ...rendered });
  }

  async sendAdminInvitationEmail(
    email: string,
    token: string,
    expiresInHours: number
  ): Promise<void> {
    const rendered = buildAdminInvitationEmail({
      projectName: this.projectName,
      token,
      expiresInHours
    });

    await this.send({ to: email, ...rendered });
  }

  async sendSuspensionEmail(
    email: string,
    displayName: string | null,
    reason: string,
    suspendedAt: Date
  ): Promise<void> {
    const rendered = buildSuspensionEmail({
      projectName: this.projectName,
      displayName,
      reason,
      suspendedAt
    });

    await this.send({ to: email, ...rendered });
  }

  async sendUnsuspensionEmail(
    email: string,
    displayName: string | null,
    unsuspendedAt: Date
  ): Promise<void> {
    const rendered = buildUnsuspensionEmail({
      projectName: this.projectName,
      displayName,
      unsuspendedAt
    });

    await this.send({ to: email, ...rendered });
  }

  async sendPriceAlertEmail(
    email: string,
    alert: PriceAlertEmailContent
  ): Promise<void> {
    const rendered = buildPriceAlertEmail({
      projectName: this.projectName,
      ...alert
    });

    await this.send({ to: email, ...rendered });
  }

  private async send({ to, subject, html, text }: MailPayload): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to,
      subject,
      html,
      text
    });
  }
}
