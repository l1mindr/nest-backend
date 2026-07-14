import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropRedundantSessionIdVersionIndex1782400000000 implements MigrationInterface {
  name = 'DropRedundantSessionIdVersionIndex1782400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_session_id_version"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_session_id_version"
        ON "session" ("id", "version")
    `);
  }
}
