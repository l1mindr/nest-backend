import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduces named roles as a second, additive source of permissions.
 *
 * `admin_permission` (direct, per-account grants) is untouched by this
 * migration and keeps working exactly as before. `role` and `role_permission`
 * let a set of permissions be named once and assigned to more than one
 * account through `user_role_assignment`; the evaluation service unions both
 * sources, so a role can only ever add reach, never take it away.
 *
 * The four new permission codes are inserted as literals, exactly like the
 * ones the previous authorization migrations added — a migration is history
 * and must keep producing the same schema no matter how the catalog is
 * edited later.
 *
 * `OWNER`, `ADMIN` and `USER` are seeded as system roles with no permissions
 * attached: they exist as catalog entries mirroring the tiers already
 * enforced by `user.role`, not as a second place those tiers are granted
 * from.
 */
export class CreateRoleTables1700000016000 implements MigrationInterface {
  name = 'CreateRoleTables1700000016000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "permission" ("code", "description") VALUES
        ('ROLE_READ',   'Read the role catalog and which permissions each role grants.'),
        ('ROLE_CREATE', 'Create a named role.'),
        ('ROLE_UPDATE', 'Rename a role, edit its description, or change the permissions it grants.'),
        ('ROLE_DELETE', 'Delete a role that has no accounts assigned to it.')
    `);

    await queryRunner.query(`
      CREATE TABLE "role" (
        "id"          uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "name"        varchar(64) NOT NULL,
        "description" varchar(255) NOT NULL,
        "isSystem"    boolean     NOT NULL DEFAULT false,
        "createdAt"   timestamp with time zone NOT NULL DEFAULT now(),
        "updatedAt"   timestamp with time zone NOT NULL DEFAULT now(),

        CONSTRAINT "PK_role_id" PRIMARY KEY ("id"),
        CONSTRAINT "role_name_unique" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "role_permission" (
        "id"         uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "roleId"     uuid        NOT NULL,
        "permission" varchar(64) NOT NULL,

        CONSTRAINT "PK_role_permission_id" PRIMARY KEY ("id"),
        CONSTRAINT "role_permission_unique" UNIQUE ("roleId", "permission"),
        CONSTRAINT "FK_role_permission_role" FOREIGN KEY ("roleId")
          REFERENCES "role"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_role_permission_permission" FOREIGN KEY ("permission")
          REFERENCES "permission"("code") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_role_permission_role_id" ON "role_permission" ("roleId")`
    );

    await queryRunner.query(`
      CREATE TABLE "user_role_assignment" (
        "id"           uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "userId"       uuid        NOT NULL,
        "roleId"       uuid        NOT NULL,
        "assignedById" uuid,
        "assignedAt"   timestamp with time zone NOT NULL DEFAULT now(),

        CONSTRAINT "PK_user_role_assignment_id" PRIMARY KEY ("id"),
        CONSTRAINT "user_role_assignment_unique" UNIQUE ("userId", "roleId"),
        CONSTRAINT "FK_user_role_assignment_user" FOREIGN KEY ("userId")
          REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_role_assignment_role" FOREIGN KEY ("roleId")
          REFERENCES "role"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_user_role_assignment_assigned_by" FOREIGN KEY ("assignedById")
          REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_user_role_assignment_user_id" ON "user_role_assignment" ("userId")`
    );

    await queryRunner.query(`
      INSERT INTO "role" ("name", "description", "isSystem") VALUES
        ('OWNER', 'The single account that bypasses permission evaluation entirely. Catalog entry only; the tier is what actually grants it.', true),
        ('ADMIN', 'The administrator tier. Catalog entry only; permissions are held through direct grants or custom roles, not through this row.', true),
        ('USER',  'The ordinary account tier. Catalog entry only; carries no permissions.', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_role_assignment"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permission"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role"`);
    await queryRunner.query(`
      DELETE FROM "permission" WHERE "code" IN
        ('ROLE_READ', 'ROLE_CREATE', 'ROLE_UPDATE', 'ROLE_DELETE')
    `);
  }
}
