import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Standardizes every date/time column on the existing schema.
 *
 * The schema was previously created with naive `timestamp` columns and a
 * `deleteAt` soft-delete column. This migration brings an environment that ran
 * the older migrations into line with the project-wide convention:
 *
 *   - every point-in-time column uses `timestamp with time zone` (timestamptz);
 *   - every point-in-time field ends with the `At` suffix (`deletedAt`).
 *
 * The historical CREATE migrations have been corrected to produce this schema
 * from the start, so on a fresh install every statement here is a no-op. It
 * exists to upgrade environments that already applied the old migrations
 * without losing data:
 *
 *   - `timestamp` -> `timestamptz` interprets each stored naive value as the
 *     UTC instant it represents (`USING "col" AT TIME ZONE 'UTC'`), which is
 *     exact under the project's UTC policy - no clock shift, no re-read.
 *   - `deleteAt` -> `deletedAt` is a pure rename.
 *
 * Both directions are guarded on the current state of the schema so that the
 * migration round trip (up -> down -> re-up) stays consistent whether or not the
 * historical migrations had already been corrected.
 */
export class StandardizeDateTimeColumns1700000007000 implements MigrationInterface {
  name = 'StandardizeDateTimeColumns1700000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.renameSoftDeleteColumn(queryRunner, 'user');
    await this.renameSoftDeleteColumn(queryRunner, 'user_verification_code');

    // Converts the project-owned columns that were naive timestamps before this
    // migration. A fresh install already creates them as timestamptz, so the
    // loop runs zero iterations.
    await queryRunner.query(`
      DO $$
      DECLARE
        col record;
      BEGIN
        FOR col IN
          SELECT *
          FROM (VALUES
            ('user', 'createdAt'),
            ('user', 'updatedAt'),
            ('user', 'deletedAt'),
            ('user_verification_code', 'createdAt'),
            ('user_verification_code', 'updatedAt'),
            ('user_verification_code', 'deletedAt'),
            ('session', 'expiresAt'),
            ('session', 'lastUsedAt'),
            ('session', 'rotatedAt'),
            ('session', 'createdAt'),
            ('session', 'updatedAt'),
            ('coin', 'lastSyncedAt'),
            ('coin', 'createdAt'),
            ('coin', 'updatedAt'),
            ('price_alert', 'expiresAt'),
            ('price_alert', 'lastTriggeredAt'),
            ('price_alert', 'createdAt'),
            ('price_alert', 'updatedAt'),
            ('admin_permission', 'grantedAt'),
            ('admin_invitation', 'expiresAt'),
            ('admin_invitation', 'acceptedAt'),
            ('admin_invitation', 'revokedAt'),
            ('admin_invitation', 'createdAt')
          ) AS pairs(table_name, column_name)
          WHERE EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = pairs.table_name
              AND c.column_name = pairs.column_name
              AND c.data_type = 'timestamp without time zone'
          )
        LOOP
          EXECUTE format(
            'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
            'public', col.table_name, col.column_name, col.column_name
          );
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse the type conversion for exactly the columns that predate the
    // standardization. Columns that were always timestamptz (the verification
    // code expiresAt / verifiedAt) are left untouched.
    await queryRunner.query(`
      DO $$
      DECLARE
        col record;
      BEGIN
        FOR col IN
          SELECT *
          FROM (VALUES
            ('user', 'createdAt'),
            ('user', 'updatedAt'),
            ('user', 'deletedAt'),
            ('user_verification_code', 'createdAt'),
            ('user_verification_code', 'updatedAt'),
            ('user_verification_code', 'deletedAt'),
            ('session', 'expiresAt'),
            ('session', 'lastUsedAt'),
            ('session', 'rotatedAt'),
            ('session', 'createdAt'),
            ('session', 'updatedAt'),
            ('coin', 'lastSyncedAt'),
            ('coin', 'createdAt'),
            ('coin', 'updatedAt'),
            ('price_alert', 'expiresAt'),
            ('price_alert', 'lastTriggeredAt'),
            ('price_alert', 'createdAt'),
            ('price_alert', 'updatedAt'),
            ('admin_permission', 'grantedAt'),
            ('admin_invitation', 'expiresAt'),
            ('admin_invitation', 'acceptedAt'),
            ('admin_invitation', 'revokedAt'),
            ('admin_invitation', 'createdAt')
          ) AS pairs(table_name, column_name)
          WHERE EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = pairs.table_name
              AND c.column_name = pairs.column_name
              AND c.data_type = 'timestamp with time zone'
          )
        LOOP
          EXECUTE format(
            'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamp USING %I AT TIME ZONE ''UTC''',
            'public', col.table_name, col.column_name, col.column_name
          );
        END LOOP;
      END $$;
    `);

    await this.renameSoftDeleteColumnBack(queryRunner, 'user');
    await this.renameSoftDeleteColumnBack(
      queryRunner,
      'user_verification_code'
    );
  }

  private async renameSoftDeleteColumn(
    queryRunner: QueryRunner,
    table: string
  ): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${table}'
            AND column_name = 'deleteAt'
        ) THEN
          ALTER TABLE "${table}" RENAME COLUMN "deleteAt" TO "deletedAt";
        END IF;
      END $$;
    `);
  }

  private async renameSoftDeleteColumnBack(
    queryRunner: QueryRunner,
    table: string
  ): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${table}'
            AND column_name = 'deletedAt'
        ) THEN
          ALTER TABLE "${table}" RENAME COLUMN "deletedAt" TO "deleteAt";
        END IF;
      END $$;
    `);
  }
}
