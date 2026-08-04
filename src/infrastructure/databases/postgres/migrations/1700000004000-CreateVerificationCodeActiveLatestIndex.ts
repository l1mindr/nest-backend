import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVerificationCodeActiveLatestIndex1700000004000 implements MigrationInterface {
  name = 'CreateVerificationCodeActiveLatestIndex1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_uvc_active_latest"
      ON "user_verification_code" ("userId", "createdAt" DESC)
      WHERE "verifiedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_uvc_active_latest"`);
  }
}
