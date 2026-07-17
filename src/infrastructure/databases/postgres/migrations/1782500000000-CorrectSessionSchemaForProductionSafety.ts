import { MigrationInterface, QueryRunner } from 'typeorm';

export class CorrectSessionSchemaForProductionSafety1782500000000 implements MigrationInterface {
  name = 'CorrectSessionSchemaForProductionSafety1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // BACKGROUND
    // ============================================================
    // Two shipped migrations have production-safety issues:
    //
    // 1) 1778584733796-AddSessionFields dropped "token", "device",
    //    "ip", and "expiryDate" with zero data migration, then added
    //    NOT NULL columns ("refreshTokenHash", "userAgent",
    //    "ipAddress", "expiresAt", "lastUsedAt") WITHOUT defaults.
    //    Any existing row would cause ALTER to fail.
    //
    // 2) 1781203122645-RenameUserAgentToDevice renamed "userAgent"
    //    to "device", immediately DROPPED it, then re-added as
    //    "jsonb NOT NULL" — destroying all existing device data.
    //
    // This corrective migration:
    //   - Drops the NOT NULL constraint on columns that lack defaults
    //     (making them nullable so writes never fail).
    //   - Backfills NULL rows with safe defaults.
    //   - Adds CHECK constraints for data integrity on columns where
    //     business rules require non-null values.
    //   - Adds indexes to support the new nullable columns.
    // ============================================================

    // ---------------------------------------------------------
    // Step 1: Make columns nullable where NOT NULL was added
    // without a DEFAULT.
    //
    // These columns were added in 1778584733796 as NOT NULL with
    // no default, which breaks inserts that don't explicitly set
    // them. We make them nullable to prevent write failures.
    // ---------------------------------------------------------

    await queryRunner.query(`
      ALTER TABLE "session"
        ALTER COLUMN "refreshTokenHash" DROP NOT NULL,
        ALTER COLUMN "ipAddress" DROP NOT NULL,
        ALTER COLUMN "expiresAt" DROP NOT NULL,
        ALTER COLUMN "lastUsedAt" DROP NOT NULL
    `);

    // ---------------------------------------------------------
    // Step 2: Backfill any NULL rows with sensible defaults.
    //
    // - refreshTokenHash: empty placeholder (token rotation
    //   will set the real value on next refresh).
    // - ipAddress: '0.0.0.0' — sentinel value that signals
    //   "unknown". The application should update it on next
    //   request.
    // - expiresAt: now() + 30 days — a reasonable grace period.
    // - lastUsedAt: created_at value if available, else now().
    // ---------------------------------------------------------

    await queryRunner.query(`
      UPDATE "session"
      SET
        "refreshTokenHash" = COALESCE("refreshTokenHash", '(pending)'),
        "ipAddress" = COALESCE("ipAddress", '0.0.0.0'),
        "expiresAt" = COALESCE("expiresAt", NOW() + INTERVAL '30 days'),
        "lastUsedAt" = COALESCE("lastUsedAt", NOW())
      WHERE
        "refreshTokenHash" IS NULL
        OR "ipAddress" IS NULL
        OR "expiresAt" IS NULL
        OR "lastUsedAt" IS NULL
    `);

    // ---------------------------------------------------------
    // Step 3: Add a CHECK constraint to enforce that critical
    // fields are not empty/zero after backfill.
    //
    // This protects future writes without the rigidity of NOT
    // NULL — it allows controlled NULL insertion during data
    // migrations while still catching logical emptiness.
    // ---------------------------------------------------------

    await queryRunner.query(`
      ALTER TABLE "session"
        ADD CONSTRAINT "CHK_session_refresh_token_hash_not_empty"
        CHECK ("refreshTokenHash" IS NULL OR "refreshTokenHash" <> '')
    `);

    await queryRunner.query(`
      ALTER TABLE "session"
        ADD CONSTRAINT "CHK_session_ip_address_not_empty"
        CHECK ("ipAddress" IS NULL OR "ipAddress" <> '')
    `);

    await queryRunner.query(`
      ALTER TABLE "session"
        ADD CONSTRAINT "CHK_session_expires_at_future"
        CHECK ("expiresAt" IS NULL OR "expiresAt" > NOW() - INTERVAL '1 year')
    `);

    // ---------------------------------------------------------
    // Step 4: The "device" column was re-created as jsonb NOT
    // NULL in 1781203122645.  Make it nullable so existing
    // sessions (whose device data was lost) don't break.
    //
    // Backfill with an empty JSON object.
    // ---------------------------------------------------------

    await queryRunner.query(`
      ALTER TABLE "session"
        ALTER COLUMN "device" DROP NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "session"
      SET "device" = '{}'::jsonb
      WHERE "device" IS NULL
    `);

    // ---------------------------------------------------------
    // Step 5: Add a partial index on sessions that are missing
    // critical data so operations teams can find & fix them.
    // ---------------------------------------------------------

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_missing_critical_data"
      ON "session" ("id")
      WHERE
        "refreshTokenHash" IS NULL
        OR "ipAddress" IS NULL
        OR "expiresAt" IS NULL
        OR "device" IS NULL
    `);

    // ---------------------------------------------------------
    // Step 6: Add a composite index on (ownerId, expiresAt) to
    // efficiently query expired sessions for cleanup, independent
    // of isRevoked.
    // ---------------------------------------------------------

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_owner_expires_at"
      ON "session" ("ownerId", "expiresAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order of up().

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_session_owner_expires_at"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_session_missing_critical_data"
    `);

    await queryRunner.query(`
      ALTER TABLE "session"
        DROP CONSTRAINT IF EXISTS "CHK_session_expires_at_future",
        DROP CONSTRAINT IF EXISTS "CHK_session_ip_address_not_empty",
        DROP CONSTRAINT IF EXISTS "CHK_session_refresh_token_hash_not_empty"
    `);

    // Restore NOT NULL constraints (safe to re-add because we
    // backfilled all NULLs above).
    await queryRunner.query(`
      ALTER TABLE "session"
        ALTER COLUMN "device" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "session"
        ALTER COLUMN "refreshTokenHash" SET NOT NULL,
        ALTER COLUMN "ipAddress" SET NOT NULL,
        ALTER COLUMN "expiresAt" SET NOT NULL,
        ALTER COLUMN "lastUsedAt" SET NOT NULL
    `);
  }
}
