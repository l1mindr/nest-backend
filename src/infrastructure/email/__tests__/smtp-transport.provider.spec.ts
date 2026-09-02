import { ConfigType } from '@nestjs/config';
import nodemailer from 'nodemailer';
import emailConfig from '../email.config';
import {
  SMTP_CONNECTION_TIMEOUT_MS,
  SMTP_GREETING_TIMEOUT_MS,
  SMTP_POOL_MAX_CONNECTIONS,
  SMTP_POOL_MAX_MESSAGES,
  SMTP_SOCKET_TIMEOUT_MS
} from '../email.constants';
import { createSmtpTransport } from '../smtp-transport.provider';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn()
}));

const mockedCreateTransport = nodemailer.createTransport as jest.Mock;

describe('createSmtpTransport', () => {
  const config: ConfigType<typeof emailConfig> = {
    appName: 'NestJS Backend',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: 'sender@test.com',
    appPassword: 'app-password',
    from: 'NestJS Backend <sender@test.com>'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateTransport.mockReturnValue({});
  });

  it('should reuse SMTP connections instead of opening one per message', () => {
    createSmtpTransport(config);

    expect(mockedCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        pool: true,
        maxConnections: SMTP_POOL_MAX_CONNECTIONS,
        maxMessages: SMTP_POOL_MAX_MESSAGES
      })
    );
  });

  it('should bound every stage that can hang so a dead socket frees its worker', () => {
    createSmtpTransport(config);

    expect(mockedCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
        greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
        socketTimeout: SMTP_SOCKET_TIMEOUT_MS
      })
    );
  });

  it('should forward the SMTP settings and credentials', () => {
    createSmtpTransport(config);

    expect(mockedCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.appPassword
        }
      })
    );
  });
});
