import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWalletTable1700000017000 implements MigrationInterface {
  name = 'CreateWalletTable1700000017000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "wallet" (
        "id"          uuid    NOT NULL DEFAULT uuid_generate_v4(),
        "userId"      uuid    NOT NULL,
        "name"        varchar(100) NOT NULL,
        "address"     varchar(255),
        "createdAt"   timestamp with time zone NOT NULL DEFAULT now(),
        "updatedAt"   timestamp with time zone NOT NULL DEFAULT now(),

        CONSTRAINT "PK_wallet_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_wallet_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_wallet_user_id" ON "wallet" ("userId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet"`);
  }
}
