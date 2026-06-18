import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionFields1778584733796 implements MigrationInterface {
  name = 'AddSessionFields1778584733796';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "session" DROP CONSTRAINT "UQ_232f8e85d7633bd6ddfad421696"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "token"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "device"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "ip"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "expiryDate"
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "refreshTokenHash" character varying NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "userAgent" json NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "ipAddress" character varying NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "isRevoked" boolean NOT NULL DEFAULT false
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "expiresAt" TIMESTAMP NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "lastUsedAt" TIMESTAMP NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "updatedAt"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "createdAt"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "lastUsedAt"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "expiresAt"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "isRevoked"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "ipAddress"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "userAgent"
        `);
    await queryRunner.query(`
            ALTER TABLE "session" DROP COLUMN "refreshTokenHash"
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "expiryDate" TIMESTAMP NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "ip" character varying NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "device" json NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD "token" character varying NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE "session"
            ADD CONSTRAINT "UQ_232f8e85d7633bd6ddfad421696" UNIQUE ("token")
        `);
  }
}
