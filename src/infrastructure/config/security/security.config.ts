import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  hashSecret: process.env.SECURITY_HASH_SECRET!
}));
