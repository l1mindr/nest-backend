import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserAndSessionTable1767562475194 implements MigrationInterface {
  name = 'CreateUserAndSessionTable1767562475194';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DO $$
        BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_type
            WHERE typname = 'user_status_enum'
        ) THEN
            CREATE TYPE "public"."user_status_enum"
            AS ENUM ('ACTIVATE', 'DEACTIVATE', 'SUSPEND');
        END IF;
        END $$;
    `);

    await queryRunner.query(`
        DO $$
        BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_type
            WHERE typname = 'user_role_enum'
        ) THEN
            CREATE TYPE "public"."user_role_enum"
            AS ENUM ('ADMIN', 'USER');
        END IF;
        END $$;
    `);

    await queryRunner.query(`
        CREATE TABLE "user" (

            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

            "name" character varying(50),

            "email" character varying NOT NULL,

            "username" character varying(30) NOT NULL,

            "password" character varying NOT NULL,

            "status" "public"."user_status_enum" NOT NULL DEFAULT 'DEACTIVATE',

            "role" "public"."user_role_enum" NOT NULL DEFAULT 'USER',

            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),

            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

            "deleteAt" TIMESTAMP,

            CONSTRAINT "users_email_unique"

            UNIQUE ("email"),

            CONSTRAINT "users_username_unique"

            UNIQUE ("username"),

            CONSTRAINT "PK_cace4a159ff9f2512dd42373760"

            PRIMARY KEY ("id")
        )
    `);

    await queryRunner.query(`
        CREATE TABLE "session" (

            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

            "token" character varying NOT NULL,

            "device" json NOT NULL,

            "ip" character varying NOT NULL,

            "expiryDate" TIMESTAMP NOT NULL,

            "ownerId" uuid NOT NULL,

            CONSTRAINT "UQ_232f8e85d7633bd6ddfad421696"

            UNIQUE ("token"),

            CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11"
            PRIMARY KEY ("id")
        )
    `);

    await queryRunner.query(`
        ALTER TABLE "session"
        ADD CONSTRAINT "FK_e1dde0bd0402cc9b1967c40a1b3" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "session" DROP CONSTRAINT "FK_e1dde0bd0402cc9b1967c40a1b3"
    `);
    await queryRunner.query(`
        DROP TABLE "session"
    `);
    await queryRunner.query(`
        DROP TABLE "user"
    `);

    await queryRunner.query(`
        DROP TYPE IF EXISTS "public"."user_role_enum"
    `);

    await queryRunner.query(`
        DROP TYPE IF EXISTS "public"."user_status_enum"
    `);
  }
}
