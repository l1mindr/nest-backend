import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduces the OWNER tier and the permission model.
 *
 * The role enum is rebuilt rather than extended with `ALTER TYPE ... ADD VALUE`
 * because migrations run inside a transaction and Postgres refuses to *use* an
 * enum value added in the same transaction — which the single-owner index below
 * has to do. Rebuilding keeps the whole migration atomic.
 *
 * The permission rows are written as literals rather than derived from
 * `PERMISSION_CATALOG`: a migration is history and must keep producing the same
 * schema no matter how the catalog is edited later. New permissions arrive in
 * their own migration.
 */
export class CreateAuthorizationTables1700000005000 implements MigrationInterface {
  name = 'CreateAuthorizationTables1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_role_enum_new" AS ENUM ('OWNER', 'ADMIN', 'USER')`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "role" TYPE "public"."user_role_enum_new" USING "role"::text::"public"."user_role_enum_new"`
    );
    await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."user_role_enum_new" RENAME TO "user_role_enum"`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'USER'`
    );

    // Every row matched by the predicate holds the same value, so uniqueness on
    // that value means at most one such row can exist. This is the database
    // half of the single-owner invariant: two concurrent promotions cannot both
    // commit, whatever the application layer believes.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_single_owner" ON "user" ("role") WHERE "role" = 'OWNER'`
    );

    await queryRunner.query(`
      CREATE TABLE "permission" (
        "code"        varchar(64)  NOT NULL,
        "description" varchar(255) NOT NULL,

        CONSTRAINT "PK_permission_code" PRIMARY KEY ("code")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "permission" ("code", "description") VALUES
        ('USER_READ',       'Read any user account and list the directory.'),
        ('USER_CREATE',     'Create user accounts on behalf of others. Reserved.'),
        ('USER_UPDATE',     'Edit the profile of any user account.'),
        ('USER_DELETE',     'Delete any user account. Reserved.'),
        ('USER_SUSPEND',    'Suspend a user account and revoke all of its sessions.'),
        ('USER_UNSUSPEND',  'Lift the suspension on a user account.'),
        ('ADMIN_READ',      'Read the administrator directory and the permissions each one holds.'),
        ('ADMIN_UPDATE',    'Edit the profile of another administrator.'),
        ('ROLE_ASSIGN',     'Grant and revoke permissions on other administrators, limited to the permissions the caller holds.'),
        ('AUDIT_READ',      'Read the audit trail. Reserved.'),
        ('SYSTEM_SETTINGS', 'Change system-wide settings. Reserved.')
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_permission" (
        "id"           uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "userId"       uuid        NOT NULL,
        "permission"   varchar(64) NOT NULL,
        "grantedById"  uuid,
        "grantedAt"    timestamp with time zone NOT NULL DEFAULT now(),

        CONSTRAINT "PK_admin_permission_id" PRIMARY KEY ("id"),
        CONSTRAINT "admin_permission_unique" UNIQUE ("userId", "permission"),
        CONSTRAINT "FK_admin_permission_user" FOREIGN KEY ("userId")
          REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_admin_permission_permission" FOREIGN KEY ("permission")
          REFERENCES "permission"("code") ON DELETE RESTRICT,
        CONSTRAINT "FK_admin_permission_granted_by" FOREIGN KEY ("grantedById")
          REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_admin_permission_user_id" ON "admin_permission" ("userId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_permission"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permission"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_user_single_owner"`);

    // The OWNER value is about to disappear from the type, so any owner has to
    // be demoted first. ADMIN is the closest surviving tier.
    await queryRunner.query(
      `UPDATE "user" SET "role" = 'ADMIN' WHERE "role" = 'OWNER'`
    );

    await queryRunner.query(
      `CREATE TYPE "public"."user_role_enum_old" AS ENUM ('ADMIN', 'USER')`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "role" TYPE "public"."user_role_enum_old" USING "role"::text::"public"."user_role_enum_old"`
    );
    await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."user_role_enum_old" RENAME TO "user_role_enum"`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'USER'`
    );
  }
}
