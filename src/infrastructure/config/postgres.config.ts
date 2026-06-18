import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs('database', () => {
  const config = {
    type: 'postgres',
    autoLoadEntities: true,
    url: process.env.DATA_SOURCE_URL
  } as const satisfies TypeOrmModuleOptions;

  return config;
});
