import { Provider } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import emailConfig from './email.config';
import {
  EMAIL_TRANSPORT,
  SMTP_CONNECTION_TIMEOUT_MS,
  SMTP_GREETING_TIMEOUT_MS,
  SMTP_POOL_MAX_CONNECTIONS,
  SMTP_POOL_MAX_MESSAGES,
  SMTP_SOCKET_TIMEOUT_MS
} from './email.constants';

export function createSmtpTransport(
  config: ConfigType<typeof emailConfig>
): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.appPassword
    },
    pool: true,
    maxConnections: SMTP_POOL_MAX_CONNECTIONS,
    maxMessages: SMTP_POOL_MAX_MESSAGES,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS
  });
}

export const smtpTransportProvider: Provider = {
  provide: EMAIL_TRANSPORT,
  inject: [emailConfig.KEY],
  useFactory: createSmtpTransport
};
