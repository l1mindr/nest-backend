import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Administrator invitations, and the permissions that administrator management
 * itself now runs on.
 *
 * `ADMIN_INVITE`, `ADMIN_DELETE` and `ADMIN_STATUS` join the catalog so the
 * administrator routes can declare a permission rather than a role. All three
 * are reserved to the owner in `PERMISSION_CATALOG`, which is where delegability
 * is decided — the rows here only record that the codes exist.
 *
 * Written as literals rather than derived from the catalog: a migration is
 * history and must keep producing the same schema however the catalog is edited
 * later.
 */
export class CreateAdminInvitationTable1700000006000 implements MigrationInterface {
  name = 'CreateAdminInvitationTable1700000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "permission" ("code", "description") VALUES
        ('ADMIN_INVITE', 'Invite new administrators and revoke pending invitations.'),
        ('ADMIN_DELETE', 'Delete an administrator account.'),
        ('ADMIN_STATUS', 'Activate, deactivate, suspend or unsuspend an administrator account.')
      ON CONFLICT ("code") DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_invitation" (
        "id"             uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "email"          varchar      NOT NULL,
        "tokenHash"      varchar(64)  NOT NULL,
        "permissions"    varchar(64)[] NOT NULL DEFAULT '{}',
        "expiresAt"      timestamp with time zone NOT NULL,
        "acceptedAt"     timestamp with time zone,
        "revokedAt"      timestamp with time zone,
        "invitedById"    uuid,
        "acceptedUserId" uuid,
        "createdAt"      timestamp with time zone NOT NULL DEFAULT now(),

        CONSTRAINT "PK_admin_invitation_id" PRIMARY KEY ("id"),
        CONSTRAINT "admin_invitation_token_unique" UNIQUE ("tokenHash"),
        CONSTRAINT "FK_admin_invitation_invited_by" FOREIGN KEY ("invitedById")
          REFERENCES "user"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_admin_invitation_accepted_user" FOREIGN KEY ("acceptedUserId")
          REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);

    // Acceptance looks the invitation up by the digest of the presented token,
    // which is the only path that runs unauthenticated. The unique constraint
    // above already indexes it; this one serves the operator-facing listing.
    await queryRunner.query(
      `CREATE INDEX "IDX_admin_invitation_email" ON "admin_invitation" ("email")`
    );

    // At most one invitation may be outstanding per address. Two live tokens
    // for one email would both look valid, yet only the first could ever create
    // the account — the second would fail on the unique email instead.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_admin_invitation_pending_email"
        ON "admin_invitation" ("email")
        WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_invitation"`);
    await queryRunner.query(
      `DELETE FROM "permission" WHERE "code" IN ('ADMIN_INVITE', 'ADMIN_DELETE', 'ADMIN_STATUS')`
    );
  }
}
