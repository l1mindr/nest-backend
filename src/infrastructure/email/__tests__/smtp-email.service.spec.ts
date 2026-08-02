import { ConfigType } from '@nestjs/config';
import { Transporter } from 'nodemailer';
import emailConfig from '../email.config';
import { SmtpEmailService } from '../smtp-email.service';

describe('SmtpEmailService', () => {
  let service: SmtpEmailService;
  let sendMail: jest.Mock;

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
    sendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
    service = new SmtpEmailService(
      { sendMail } as unknown as Transporter,
      config
    );
  });

  describe('sendVerificationEmail', () => {
    it('should send the rendered verification email', async () => {
      await service.sendVerificationEmail('user@test.com', '123456', 3);

      expect(sendMail).toHaveBeenCalledTimes(1);
      const [mail] = sendMail.mock.calls[0];

      expect(mail.from).toBe('NestJS Backend <sender@test.com>');
      expect(mail.to).toBe('user@test.com');
      expect(mail.subject).toContain('NestJS Backend');
      expect(mail.html).toContain('123456');
      expect(mail.html).toContain('expires in 3 minutes');
      expect(mail.html).not.toContain('UTC');
      expect(mail.text).toContain('123456');
    });

    it('should never log the verification code', async () => {
      const consoleLog = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      await service.sendVerificationEmail('user@test.com', '123456', 3);

      expect(consoleLog).not.toHaveBeenCalled();
      consoleLog.mockRestore();
    });
  });

  describe('sendSuspensionEmail', () => {
    it('should send the rendered suspension email', async () => {
      await service.sendSuspensionEmail(
        'user@test.com',
        'John',
        'Terms of service violation',
        new Date('2024-01-01T12:34:00Z')
      );

      const [mail] = sendMail.mock.calls[0];

      expect(mail.subject).toContain('suspended');
      expect(mail.html).toContain('Terms of service violation');
    });
  });

  describe('sendUnsuspensionEmail', () => {
    it('should send the rendered unsuspension email', async () => {
      await service.sendUnsuspensionEmail(
        'user@test.com',
        'John',
        new Date('2024-01-01T12:34:00Z')
      );

      const [mail] = sendMail.mock.calls[0];

      expect(mail.subject).toContain('unsuspended');
    });
  });

  describe('error handling', () => {
    it('should propagate SMTP transport failures', async () => {
      const error = new Error('connection refused');
      sendMail.mockRejectedValue(error);

      await expect(
        service.sendVerificationEmail('user@test.com', '123456', 3)
      ).rejects.toThrow(error);
    });
  });
});
