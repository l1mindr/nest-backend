import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableUuidOsspExtension1767562475000 implements MigrationInterface {
  name = 'EnableUuidOsspExtension1767562475000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  }

  public async down(): Promise<void> {
    // The extension may be shared with schemas outside this application.
  }
}
