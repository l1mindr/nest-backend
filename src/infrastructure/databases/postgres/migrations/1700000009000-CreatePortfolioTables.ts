import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePortfolioTables1700000009000 implements MigrationInterface {
  name = 'CreatePortfolioTables1700000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."portfolio_source_type_enum" AS ENUM ('LEDGER', 'EXCHANGE', 'WALLET', 'OTHER')`
    );

    await queryRunner.query(`
      CREATE TABLE "portfolio" (
        "id"             uuid    NOT NULL DEFAULT uuid_generate_v4(),
        "userId"         uuid    NOT NULL,
        "name"           varchar(100) NOT NULL,
        "sourceType"     "public"."portfolio_source_type_enum" NOT NULL,
        "walletAddress"  varchar(255),
        "createdAt"      timestamp with time zone NOT NULL DEFAULT now(),
        "updatedAt"      timestamp with time zone NOT NULL DEFAULT now(),

        CONSTRAINT "PK_portfolio_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_portfolio_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "holding" (
        "id"           uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "userId"       uuid          NOT NULL,
        "portfolioId"  uuid          NOT NULL,
        "assetId"      uuid          NOT NULL,
        "amount"       decimal(36,18) NOT NULL,
        "notes"        varchar(1000),
        "createdAt"    timestamp with time zone NOT NULL DEFAULT now(),
        "updatedAt"    timestamp with time zone NOT NULL DEFAULT now(),

        CONSTRAINT "PK_holding_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_holding_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION,
        CONSTRAINT "FK_holding_portfolio" FOREIGN KEY ("portfolioId") REFERENCES "portfolio"("id") ON DELETE NO ACTION,
        CONSTRAINT "FK_holding_asset" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE NO ACTION,
        CONSTRAINT "CHK_holding_amount_positive" CHECK ("amount" > 0)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_portfolio_user_id" ON "portfolio" ("userId")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_holding_portfolio_asset" ON "holding" ("portfolioId", "assetId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_holding_user_id" ON "holding" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_holding_asset_id" ON "holding" ("assetId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "holding"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portfolio"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."portfolio_source_type_enum"`
    );
  }
}
