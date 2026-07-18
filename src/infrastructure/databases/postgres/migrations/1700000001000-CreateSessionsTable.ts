import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSessionsTable1700000001000 implements MigrationInterface {
  name = 'CreateSessionsTable1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "session" (
        "id"               uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "refreshTokenHash" varchar     NOT NULL,
        "device"           jsonb       NOT NULL,
        "ipAddress"        varchar     NOT NULL,
        "isRevoked"        boolean     NOT NULL DEFAULT false,
        "expiresAt"        timestamp   NOT NULL,
        "lastUsedAt"       timestamp   NOT NULL,
        "version"          integer     NOT NULL DEFAULT 0,
        "rotatedAt"        timestamp,
        "createdAt"        timestamp   NOT NULL DEFAULT now(),
        "updatedAt"        timestamp   NOT NULL DEFAULT now(),
        "ownerId"          uuid        NOT NULL,

        CONSTRAINT "PK_session_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "session"
      ADD CONSTRAINT "FK_session_owner"
      FOREIGN KEY ("ownerId") REFERENCES "user"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_session_owner_active"
      ON "session" ("ownerId", "isRevoked", "expiresAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_session_owner_created"
      ON "session" ("ownerId", "isRevoked", "expiresAt", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_session_expires_at"
      ON "session" ("expiresAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_expires_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_owner_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_session_owner_active"`);

    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "FK_session_owner"`
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "session"`);
  }
}
