import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1700000000000 implements MigrationInterface {
  name = 'CreateUsersTable1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_status_enum" AS ENUM ('ACTIVATE', 'DEACTIVATE', 'SUSPEND')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_role_enum" AS ENUM ('ADMIN', 'USER')`
    );

    await queryRunner.query(`
      CREATE TABLE "user" (
        "id"        uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "name"      varchar(50),
        "email"     varchar      NOT NULL,
        "username"  varchar(30)  NOT NULL,
        "password"  varchar      NOT NULL,
        "status"    "public"."user_status_enum" NOT NULL DEFAULT 'DEACTIVATE',
        "role"      "public"."user_role_enum"   NOT NULL DEFAULT 'USER',
        "createdAt" timestamp    NOT NULL DEFAULT now(),
        "updatedAt" timestamp    NOT NULL DEFAULT now(),
        "deleteAt"  timestamp,

        CONSTRAINT "PK_user_id"            PRIMARY KEY ("id"),
        CONSTRAINT "users_email_unique"    UNIQUE ("email"),
        CONSTRAINT "users_username_unique" UNIQUE ("username")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."user_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."user_status_enum"`);
  }
}
