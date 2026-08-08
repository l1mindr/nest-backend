import { registerAs } from '@nestjs/config';

export default registerAs('coingecko', () => ({
  baseUrl: 'https://api.coingecko.com/api/v3',
  apiKey: process.env.COINGECKO_API_KEY || null,
  pageSize: 250,
  maxPages: 5
}));
