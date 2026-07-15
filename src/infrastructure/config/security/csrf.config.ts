import { registerAs } from '@nestjs/config';

export default registerAs('csrf', () => ({
  csrfTokenSecret: process.env.CSRF_TOKEN_SECRET!
}));
