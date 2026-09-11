import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records the currency a transaction's price and fee were entered in.
 *
 * `price` and `fee` keep their existing meaning — USD, the valuation currency
 * every cost-basis and P&L figure is denominated in — so no existing row's
 * numbers change and no backfill is needed. The default on `priceCurrency`
 * states what those rows already implied.
 *
 * The three nullable columns only carry a converted entry: the value as the
 * user typed it and the rate it was converted at. Freezing the rate per row is
 * what keeps an old transaction meaning what it meant when it was recorded,
 * rather than being restated every time the market moves.
 */
export class AddPriceCurrencyToPortfolioTransaction1700000020000 implements MigrationInterface {
  name = 'AddPriceCurrencyToPortfolioTransaction1700000020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."transaction_price_currency_enum" AS ENUM ('USD', 'TOMAN')`
    );

    await queryRunner.query(`
      ALTER TABLE "portfolio_transaction"
        ADD "priceCurrency" "public"."transaction_price_currency_enum" NOT NULL DEFAULT 'USD',
        ADD "enteredPrice" numeric(30,8),
        ADD "enteredFee" numeric(30,8),
        ADD "usdtTomanRate" numeric(30,8)
    `);

    await queryRunner.query(`
      ALTER TABLE "portfolio_transaction"
        ADD CONSTRAINT "CHK_portfolio_transaction_entered_price_positive"
          CHECK ("enteredPrice" > 0),
        ADD CONSTRAINT "CHK_portfolio_transaction_entered_fee_nonnegative"
          CHECK ("enteredFee" >= 0),
        ADD CONSTRAINT "CHK_portfolio_transaction_usdt_toman_rate_positive"
          CHECK ("usdtTomanRate" > 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "portfolio_transaction"
        DROP CONSTRAINT "CHK_portfolio_transaction_usdt_toman_rate_positive",
        DROP CONSTRAINT "CHK_portfolio_transaction_entered_fee_nonnegative",
        DROP CONSTRAINT "CHK_portfolio_transaction_entered_price_positive"
    `);

    await queryRunner.query(`
      ALTER TABLE "portfolio_transaction"
        DROP COLUMN "usdtTomanRate",
        DROP COLUMN "enteredFee",
        DROP COLUMN "enteredPrice",
        DROP COLUMN "priceCurrency"
    `);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."transaction_price_currency_enum"`
    );
  }
}
