import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs('database', () => {
  const config = {
    type: 'postgres',
    autoLoadEntities: true,
    url: `postgresql://${process.env.DATA_SOURCE_USERNAME}:${process.env.DATA_SOURCE_PASSWORD}@${process.env.DATA_SOURCE_HOST}:${process.env.DATA_SOURCE_PORT}/${process.env.DATA_SOURCE_DATABASE}`
  } as const satisfies TypeOrmModuleOptions;

  return config;
});
