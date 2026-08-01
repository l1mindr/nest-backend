import { Provider } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import emailConfig from './email.config';
import { EMAIL_TRANSPORT } from './email.constants';

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
    }
  });
}

export const smtpTransportProvider: Provider = {
  provide: EMAIL_TRANSPORT,
  inject: [emailConfig.KEY],
  useFactory: createSmtpTransport
};
