import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePortfolioTransactionTable1700000010000 implements MigrationInterface {
  name = 'CreatePortfolioTransactionTable1700000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."portfolio_transaction_type_enum" AS ENUM ('BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT', 'DEPOSIT', 'WITHDRAWAL')`
    );

    await queryRunner.query(`
      CREATE TABLE "portfolio_transaction" (
        "id"           uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "userId"       uuid          NOT NULL,
        "portfolioId"  uuid          NOT NULL,
        "assetId"      uuid          NOT NULL,
        "type"         "public"."portfolio_transaction_type_enum" NOT NULL,
        "amount"       decimal(36,18) NOT NULL,
        "price"        decimal(30,8),
        "fee"          decimal(30,8),
        "occurredAt"   timestamp with time zone NOT NULL,
        "notes"        varchar(1000),
        "createdAt"    timestamp with time zone NOT NULL DEFAULT now(),
        "updatedAt"    timestamp with time zone NOT NULL DEFAULT now(),

        CONSTRAINT "PK_portfolio_transaction_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_portfolio_transaction_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION,
        CONSTRAINT "FK_portfolio_transaction_portfolio" FOREIGN KEY ("portfolioId") REFERENCES "portfolio"("id") ON DELETE NO ACTION,
        CONSTRAINT "FK_portfolio_transaction_asset" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE NO ACTION,
        CONSTRAINT "CHK_portfolio_transaction_amount_positive" CHECK ("amount" > 0),
        CONSTRAINT "CHK_portfolio_transaction_price_positive" CHECK ("price" > 0),
        CONSTRAINT "CHK_portfolio_transaction_fee_nonnegative" CHECK ("fee" >= 0)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_portfolio_transaction_user_id" ON "portfolio_transaction" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_portfolio_transaction_portfolio_occurred" ON "portfolio_transaction" ("portfolioId", "occurredAt" DESC, "id" DESC)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_portfolio_transaction_portfolio_asset" ON "portfolio_transaction" ("portfolioId", "assetId", "occurredAt" DESC)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "portfolio_transaction"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."portfolio_transaction_type_enum"`
    );
  }
}
