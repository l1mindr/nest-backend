import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends the asset-filtered transaction index with the `id` tiebreaker column
 * so that keyset cursor pagination on `(portfolioId, assetId)` queries can
 * resolve the full `(occurredAt, id)` cursor predicate from the index without
 * a heap fetch or additional sort.
 *
 * Before: (portfolioId, assetId, occurredAt DESC)
 * After:  (portfolioId, assetId, occurredAt DESC, id DESC)
 *
 * The new index is a strict superset of the old one — it covers all queries the
 * previous index served and additionally satisfies the cursor id tiebreaker
 * in-index. The old index is dropped because keeping both would be redundant.
 */
export class OptimizePortfolioTransactionIndexes1700000012000 implements MigrationInterface {
  name = 'OptimizePortfolioTransactionIndexes1700000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_portfolio_transaction_portfolio_asset"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_portfolio_transaction_portfolio_asset" ON "portfolio_transaction" ("portfolioId", "assetId", "occurredAt" DESC, "id" DESC)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_portfolio_transaction_portfolio_asset"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_portfolio_transaction_portfolio_asset" ON "portfolio_transaction" ("portfolioId", "assetId", "occurredAt" DESC)`
    );
  }
}
