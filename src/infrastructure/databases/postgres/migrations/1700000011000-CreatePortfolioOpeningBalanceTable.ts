import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePortfolioOpeningBalanceTable1700000011000 implements MigrationInterface {
  name = 'CreatePortfolioOpeningBalanceTable1700000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "portfolio_opening_balance" (
        "id"              uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "userId"          uuid         NOT NULL,
        "portfolioId"     uuid         NOT NULL,
        "assetId"         uuid         NOT NULL,
        "openingQuantity" decimal(36,18) NOT NULL,
        "openingCost"     decimal(60,26) NOT NULL,
        "createdAt"       timestamp with time zone NOT NULL DEFAULT now(),
        "updatedAt"       timestamp with time zone NOT NULL DEFAULT now(),

        CONSTRAINT "PK_portfolio_opening_balance_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_portfolio_opening_balance_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION,
        CONSTRAINT "FK_portfolio_opening_balance_portfolio" FOREIGN KEY ("portfolioId") REFERENCES "portfolio"("id") ON DELETE NO ACTION,
        CONSTRAINT "FK_portfolio_opening_balance_asset" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE NO ACTION,
        CONSTRAINT "CHK_portfolio_opening_balance_quantity_nonnegative" CHECK ("openingQuantity" >= 0),
        CONSTRAINT "CHK_portfolio_opening_balance_cost_nonnegative" CHECK ("openingCost" >= 0)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_portfolio_opening_balance_user_id" ON "portfolio_opening_balance" ("userId")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portfolio_opening_balance_portfolio_asset" ON "portfolio_opening_balance" ("portfolioId", "assetId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "portfolio_opening_balance"`);
  }
}
