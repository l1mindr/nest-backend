import { MigrationInterface, QueryRunner } from 'typeorm';

export class IncreaseAssetPricePrecision1700000015000 implements MigrationInterface {
  name = 'IncreaseAssetPricePrecision1700000015000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset" ALTER COLUMN "currentPrice" TYPE numeric(40, 8)`
    );
    await queryRunner.query(
      `ALTER TABLE "asset" ALTER COLUMN "priceChange24h" TYPE numeric(40, 8)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset" ALTER COLUMN "currentPrice" TYPE numeric(30, 8)`
    );
    await queryRunner.query(
      `ALTER TABLE "asset" ALTER COLUMN "priceChange24h" TYPE numeric(30, 8)`
    );
  }
}
