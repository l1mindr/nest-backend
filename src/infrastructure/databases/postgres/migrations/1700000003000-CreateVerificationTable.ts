import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVerificationTable1700000003000 implements MigrationInterface {
  name = 'CreateVerificationTable1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."user_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_VERIFICATION'`
    );

    await queryRunner.query(`
      CREATE TABLE "user_verification_code" (
        "id"         uuid    NOT NULL DEFAULT uuid_generate_v4(),
        "userId"     uuid    NOT NULL,
        "codeHash"   varchar NOT NULL,
        "expiresAt"  timestamp with time zone NOT NULL,
        "verifiedAt" timestamp with time zone,
        "createdAt"  timestamp with time zone NOT NULL DEFAULT now(),
        "updatedAt"  timestamp with time zone NOT NULL DEFAULT now(),
        "deletedAt"  timestamp with time zone,

        CONSTRAINT "PK_user_verification_code_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_verification_code_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_user_verification_code_userId" ON "user_verification_code" ("userId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_verification_code"`);
  }
}
