import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRotatedAtFieldOnSessionEntity1781430797078 implements MigrationInterface {
  name = 'AddRotatedAtFieldOnSessionEntity1781430797078';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "session"
        ADD COLUMN IF NOT EXISTS "rotatedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "session"
        DROP COLUMN IF EXISTS "rotatedAt"
    `);
  }
}
