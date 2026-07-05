import postgresConfig from '@infrastructure/config/databases/postgres.config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forRootAsync(postgresConfig.asProvider())]
})
export class PostgresModule {}
