import { MigrationInterface, QueryRunner } from 'typeorm';

export class IncreaseAssetSupplyPrecision1700000014000 implements MigrationInterface {
  name = 'IncreaseAssetSupplyPrecision1700000014000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset" ALTER COLUMN "circulatingSupply" TYPE numeric(40, 8)`
    );
    await queryRunner.query(
      `ALTER TABLE "asset" ALTER COLUMN "totalSupply" TYPE numeric(40, 8)`
    );
    await queryRunner.query(
      `ALTER TABLE "asset" ALTER COLUMN "maxSupply" TYPE numeric(40, 8)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset" ALTER COLUMN "circulatingSupply" TYPE numeric(30, 8)`
    );
    await queryRunner.query(
      `ALTER TABLE "asset" ALTER COLUMN "totalSupply" TYPE numeric(30, 8)`
    );
    await queryRunner.query(
      `ALTER TABLE "asset" ALTER COLUMN "maxSupply" TYPE numeric(30, 8)`
    );
  }
}
