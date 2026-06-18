import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameUserAgentToDevice1781203122645 implements MigrationInterface {
  name = 'RenameUserAgentToDevice1781203122645';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "session"
                RENAME COLUMN "userAgent" TO "device"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "device"
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "device" jsonb NOT NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "device"
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "device" json NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
                RENAME COLUMN "device" TO "userAgent"
        `);
  }
}
