import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the portfolio_calculation_checkpoint table.
 *
 * Each row stores the intermediate calculation state for one
 * (portfolioId, assetId, costBasisStrategy) scope so that the P&L use case
 * can resume from the checkpoint instead of replaying the full ledger.
 *
 * The table is NOT a P&L cache — it holds only reusable intermediate state.
 * Market-price-dependent values are never stored here.
 */
export class CreatePortfolioCalculationCheckpointTable1700000013000 implements MigrationInterface {
  name = 'CreatePortfolioCalculationCheckpointTable1700000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."portfolio_calculation_checkpoint_costbasisstrategy_enum" AS ENUM ('AVERAGE', 'FIFO', 'LIFO')`
    );

    await queryRunner.query(`
      CREATE TABLE "portfolio_calculation_checkpoint" (
        "id"                          uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "portfolioId"                 uuid          NOT NULL,
        "assetId"                     uuid          NOT NULL,
        "costBasisStrategy"           "public"."portfolio_calculation_checkpoint_costbasisstrategy_enum" NOT NULL,
        "lastTransactionId"           uuid          NOT NULL,
        "lastTransactionOccurredAt"   varchar(32)   NOT NULL,
        "quantity"                    decimal(36,18) NOT NULL,
        "totalCost"                   decimal(60,26) NOT NULL,
        "lots"                        jsonb,
        "realizedPnlEvents"           jsonb         NOT NULL DEFAULT '[]',
        "openingBalanceUpdatedAt"     timestamp with time zone,
        "createdAt"                   timestamp with time zone NOT NULL DEFAULT now(),
        "updatedAt"                   timestamp with time zone NOT NULL DEFAULT now(),

        CONSTRAINT "PK_portfolio_calculation_checkpoint_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pcc_portfolio" FOREIGN KEY ("portfolioId") REFERENCES "portfolio"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pcc_asset" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pcc_last_transaction" FOREIGN KEY ("lastTransactionId") REFERENCES "portfolio_transaction"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_pcc_portfolio_asset_strategy" ON "portfolio_calculation_checkpoint" ("portfolioId", "assetId", "costBasisStrategy")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pcc_portfolio_id" ON "portfolio_calculation_checkpoint" ("portfolioId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "portfolio_calculation_checkpoint"`
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."portfolio_calculation_checkpoint_costbasisstrategy_enum"`
    );
  }
}
