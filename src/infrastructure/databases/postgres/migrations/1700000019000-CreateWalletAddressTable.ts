import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves a wallet's address off the wallet row and into a child table, so one
 * named wallet can hold an address per blockchain network.
 *
 * Existing addresses are preserved: each non-blank `wallet.address` becomes a
 * `wallet_address` row before the column is dropped. They are recorded under
 * `OTHER` because the old schema never stored which chain an address belonged
 * to — guessing it from the address shape would silently mislabel anything
 * ambiguous, so the network is left honest and the user can re-assign it.
 */
export class CreateWalletAddressTable1700000019000 implements MigrationInterface {
  name = 'CreateWalletAddressTable1700000019000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."wallet_network_enum" AS ENUM (
        'BITCOIN', 'ETHEREUM', 'SOLANA', 'BNB_CHAIN', 'POLYGON',
        'ARBITRUM', 'OPTIMISM', 'AVALANCHE', 'BASE', 'TRON', 'OTHER'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "wallet_address" (
        "id"        uuid NOT NULL DEFAULT uuid_generate_v4(),
        "walletId"  uuid NOT NULL,
        "network"   "public"."wallet_network_enum" NOT NULL,
        "address"   varchar(255) NOT NULL,
        "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
        "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),

        CONSTRAINT "PK_wallet_address_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_wallet_address_wallet_network" UNIQUE ("walletId", "network"),
        CONSTRAINT "FK_wallet_address_wallet"
          FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_address_wallet_id" ON "wallet_address" ("walletId")`
    );

    // Carry every stored address across before the column goes.
    await queryRunner.query(`
      INSERT INTO "wallet_address" ("walletId", "network", "address")
      SELECT "id", 'OTHER', btrim("address")
        FROM "wallet"
       WHERE "address" IS NOT NULL AND btrim("address") <> ''
    `);

    await queryRunner.query(`ALTER TABLE "wallet" DROP COLUMN "address"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wallet" ADD "address" varchar(255)`);

    // The column holds one address, so the wallet's first-created one is
    // restored and any others are necessarily lost — the reverse of this
    // migration cannot be lossless once a second network has been added.
    await queryRunner.query(`
      UPDATE "wallet" AS w
         SET "address" = first_address."address"
        FROM (
          SELECT DISTINCT ON ("walletId") "walletId", "address"
            FROM "wallet_address"
           ORDER BY "walletId", "createdAt", "id"
        ) AS first_address
       WHERE first_address."walletId" = w."id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_address"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."wallet_network_enum"`
    );
  }
}
