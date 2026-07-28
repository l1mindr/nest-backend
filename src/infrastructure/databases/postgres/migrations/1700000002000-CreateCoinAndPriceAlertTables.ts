import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoinAndPriceAlertTables1700000002000 implements MigrationInterface {
  name = 'CreateCoinAndPriceAlertTables1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."alert_direction_enum" AS ENUM ('BUY', 'SELL')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_trigger_mode_enum" AS ENUM ('ONCE', 'REPEAT')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_status_enum" AS ENUM ('ACTIVE', 'TRIGGERED', 'EXPIRED', 'CANCELLED')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_channel_enum" AS ENUM ('EMAIL', 'SMS')`
    );

    await queryRunner.query(`
      CREATE TABLE "coin" (
        "id"           varchar      NOT NULL,
        "symbol"       varchar      NOT NULL,
        "name"         varchar      NOT NULL,
        "image"        varchar,
        "isActive"     boolean      NOT NULL DEFAULT true,
        "lastSyncedAt" timestamp    NOT NULL,
        "createdAt"    timestamp    NOT NULL DEFAULT now(),
        "updatedAt"    timestamp    NOT NULL DEFAULT now(),

        CONSTRAINT "PK_coin_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "price_alert" (
        "id"                          uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "userId"                      uuid         NOT NULL,
        "coinId"                      varchar      NOT NULL,
        "direction"                   "public"."alert_direction_enum"   NOT NULL,
        "targetPrice"                 decimal      NOT NULL,
        "triggerMode"                 "public"."alert_trigger_mode_enum" NOT NULL DEFAULT 'ONCE',
        "status"                      "public"."alert_status_enum"      NOT NULL DEFAULT 'ACTIVE',
        "expiresAt"                   timestamp,
        "notificationChannels"        "public"."notification_channel_enum"[] NOT NULL,
        "notificationCooldownMinutes" integer      NOT NULL DEFAULT 60,
        "lastCheckedPrice"            decimal,
        "lastTriggeredAt"             timestamp,
        "triggeredCount"              integer      NOT NULL DEFAULT 0,
        "createdAt"                   timestamp    NOT NULL DEFAULT now(),
        "updatedAt"                   timestamp    NOT NULL DEFAULT now(),

        CONSTRAINT "PK_price_alert_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_price_alert_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION,
        CONSTRAINT "FK_price_alert_coin" FOREIGN KEY ("coinId") REFERENCES "coin"("id") ON DELETE NO ACTION,
        CONSTRAINT "CHK_price_alert_target_price_positive" CHECK ("targetPrice" > 0),
        CONSTRAINT "CHK_price_alert_notification_cooldown_positive" CHECK ("notificationCooldownMinutes" > 0),
        CONSTRAINT "CHK_price_alert_notification_channels_not_empty" CHECK (cardinality("notificationChannels") > 0)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_price_alert_user_id" ON "price_alert" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_price_alert_status" ON "price_alert" ("status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_price_alert_coin_id" ON "price_alert" ("coinId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_price_alert_user_status" ON "price_alert" ("userId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_price_alert_status_coin" ON "price_alert" ("status", "coinId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_price_alert_expires_at" ON "price_alert" ("expiresAt")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "price_alert"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "coin"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."notification_channel_enum"`
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."alert_status_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."alert_trigger_mode_enum"`
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."alert_direction_enum"`
    );
  }
}
