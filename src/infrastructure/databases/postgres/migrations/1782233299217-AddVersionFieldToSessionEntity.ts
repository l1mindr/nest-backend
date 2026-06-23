import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVersionFieldToSessionEntity1782233299217 implements MigrationInterface {
  name = 'AddVersionFieldToSessionEntity1782233299217';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "session"
        ADD COLUMN "version" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
        CREATE INDEX "IDX_session_id_version"
        ON "session" ("id", "version")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DROP INDEX "IDX_session_id_version"
    `);

    await queryRunner.query(`
        ALTER TABLE "session" DROP COLUMN "version"
    `);
  }
}
