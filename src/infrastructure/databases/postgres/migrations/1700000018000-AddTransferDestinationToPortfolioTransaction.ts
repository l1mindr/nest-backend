import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransferDestinationToPortfolioTransaction1700000018000 implements MigrationInterface {
  name = 'AddTransferDestinationToPortfolioTransaction1700000018000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_destination_type_enum" AS ENUM ('EXCHANGE', 'WALLET')`
    );

    await queryRunner.query(`
      ALTER TABLE "portfolio_transaction"
        ADD "destinationType" "public"."transfer_destination_type_enum",
        ADD "exchangeName" varchar(255),
        ADD "txid" varchar(255),
        ADD "walletId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "portfolio_transaction"
        ADD CONSTRAINT "FK_portfolio_transaction_wallet"
        FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "portfolio_transaction" DROP CONSTRAINT "FK_portfolio_transaction_wallet"`
    );
    await queryRunner.query(`
      ALTER TABLE "portfolio_transaction"
        DROP COLUMN "walletId",
        DROP COLUMN "txid",
        DROP COLUMN "exchangeName",
        DROP COLUMN "destinationType"
    `);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."transfer_destination_type_enum"`
    );
  }
}
