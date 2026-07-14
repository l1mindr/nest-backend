import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionIndexes1782300000000 implements MigrationInterface {
  name = 'AddSessionIndexes1782300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_session_owner_active"
        ON "session" ("ownerId", "isRevoked", "expiresAt")
    `);

    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_session_expires_at"
        ON "session" ("expiresAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_session_expires_at"
    `);
    await queryRunner.query(`
        DROP INDEX IF EXISTS "IDX_session_owner_active"
    `);
  }
}
