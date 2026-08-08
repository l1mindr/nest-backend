import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAssetsTable1700000008000 implements MigrationInterface {
  name = 'CreateAssetsTable1700000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "asset" (
        "id"                          uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "coinGeckoId"                 varchar(100) NOT NULL,
        "symbol"                      varchar(32)  NOT NULL,
        "name"                        varchar(100) NOT NULL,
        "imageUrl"                    varchar,
        "currentPrice"                numeric(30, 8),
        "marketCap"                   numeric(30, 2),
        "marketCapRank"               integer,
        "totalVolume"                 numeric(30, 2),
        "circulatingSupply"           numeric(30, 8),
        "totalSupply"                 numeric(30, 8),
        "maxSupply"                   numeric(30, 8),
        "priceChange24h"              numeric(30, 8),
        "priceChangePercentage24h"    numeric(30, 4),
        "lastSyncedAt"                timestamp with time zone NOT NULL,
        "createdAt"                   timestamp with time zone NOT NULL DEFAULT now(),
        "updatedAt"                   timestamp with time zone NOT NULL DEFAULT now(),

        CONSTRAINT "PK_asset_id"              PRIMARY KEY ("id"),
        CONSTRAINT "uq_asset_coin_gecko_id"   UNIQUE ("coinGeckoId")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_asset_coin_gecko_id" ON "asset" ("coinGeckoId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_asset_symbol" ON "asset" ("symbol")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_asset_name" ON "asset" ("name")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_asset_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_asset_symbol"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_asset_coin_gecko_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset"`);
  }
}
