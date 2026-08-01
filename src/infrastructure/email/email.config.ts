import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  appName: process.env.APP_NAME ?? 'NestJS Backend',
  host: process.env.EMAIL_HOST!,
  port: Number(process.env.EMAIL_PORT ?? 587),
  secure: process.env.EMAIL_SECURE === 'true',
  user: process.env.EMAIL_USER!,
  appPassword: process.env.EMAIL_APP_PASSWORD!,
  from: process.env.EMAIL_FROM!
}));
