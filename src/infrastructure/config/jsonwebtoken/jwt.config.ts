import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET!,
  refreshTokenSecret: process.env.Refresh_TOKEN_SECRET!
}));

export interface IJwtConfig {
  secret: string;
  accessTokenSecret: string;
  refreshTokenSecret: string;
}
