import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  AssetSyncData,
  IAssetRepository
} from '../../application/interfaces/assets.interface';
import { Asset } from '../../domain/entities/asset.entity';

const ASSET_UPSERT_BATCH_SIZE = 1_000;

@Injectable()
export class AssetRepository implements IAssetRepository {
  private get assetRepo(): Repository<Asset> {
    return this.dataSource.getRepository(Asset);
  }

  constructor(private readonly dataSource: DataSource) {}

  async upsertMany(assets: AssetSyncData[]): Promise<void> {
    for (
      let index = 0;
      index < assets.length;
      index += ASSET_UPSERT_BATCH_SIZE
    ) {
      await this.assetRepo.upsert(
        assets.slice(index, index + ASSET_UPSERT_BATCH_SIZE),
        {
          conflictPaths: ['coinGeckoId'],
          skipUpdateIfNoValuesChanged: true
        }
      );
    }
  }

  async findById(id: string): Promise<Asset | null> {
    return this.assetRepo.findOneBy({ id });
  }

  async list(options: {
    search: string;
    cursorId: string | null;
    limit: number;
  }): Promise<Asset[]> {
    const qb = this.assetRepo.createQueryBuilder('asset');

    if (options.search) {
      qb.where(
        '(asset.symbol ILIKE :q OR asset.name ILIKE :q OR asset.coinGeckoId ILIKE :q)',
        { q: `%${options.search}%` }
      );
    }

    if (options.cursorId) {
      qb.andWhere('asset.id > :cursorId', { cursorId: options.cursorId });
    }

    return qb.orderBy('asset.id', 'ASC').take(options.limit).getMany();
  }
}
