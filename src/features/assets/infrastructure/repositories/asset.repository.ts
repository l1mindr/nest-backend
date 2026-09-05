import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  AssetListCursor,
  AssetSyncData,
  IAssetRepository
} from '../../application/interfaces/assets.interface';
import { Asset } from '../../domain/entities/asset.entity';

const ASSET_UPSERT_BATCH_SIZE = 1_000;

const ASSET_UPSERT_COLUMNS = [
  'coinGeckoId',
  'symbol',
  'name',
  'imageUrl',
  'currentPrice',
  'marketCap',
  'marketCapRank',
  'totalVolume',
  'circulatingSupply',
  'totalSupply',
  'maxSupply',
  'priceChange24h',
  'priceChangePercentage24h',
  'lastSyncedAt'
] as const;

const ASSET_UPSERT_CONFLICT_TARGET =
  'ON CONFLICT ("coinGeckoId") DO UPDATE SET';

@Injectable()
export class AssetRepository implements IAssetRepository {
  private get assetRepo(): Repository<Asset> {
    return this.dataSource.getRepository(Asset);
  }

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Persists a market data snapshot as a single multi-row `INSERT ... ON
   * CONFLICT` statement per batch.
   *
   * Two properties of the statement matter beyond a plain upsert:
   *
   * - `currentPrice` is preserved (`COALESCE(EXCLUDED."currentPrice",
   *   "asset"."currentPrice")`) so a provider that reports no price for an
   *   asset — or a run that only partially succeeded — never clears a price we
   *   already have. The price and its `lastSyncedAt` stamp are written in the
   *   same statement, so the two can never disagree about a successful run.
   * - The `WHERE` clause skips rows whose observable values are unchanged, so a
   *   no-op run does not churn `updatedAt` for every asset.
   */
  async upsertMany(assets: AssetSyncData[]): Promise<void> {
    for (
      let index = 0;
      index < assets.length;
      index += ASSET_UPSERT_BATCH_SIZE
    ) {
      const batch = assets.slice(index, index + ASSET_UPSERT_BATCH_SIZE);

      await this.dataSource.query(this.buildUpsertSql(batch.length), [
        ...this.flatten(batch)
      ]);
    }
  }

  private buildUpsertSql(rowCount: number): string {
    const columns = ASSET_UPSERT_COLUMNS.map((c) => `"${c}"`).join(', ');

    const rows: string[] = [];
    let param = 1;

    for (let row = 0; row < rowCount; row++) {
      const placeholders = ASSET_UPSERT_COLUMNS.map(() => `$${param++}`).join(
        ', '
      );
      rows.push(`(${placeholders})`);
    }

    const setClauses = ASSET_UPSERT_COLUMNS.filter(
      (c) => c !== 'coinGeckoId' && c !== 'currentPrice'
    ).map((c) => `"${c}" = EXCLUDED."${c}"`);

    return `
      INSERT INTO "asset" (${columns})
      VALUES ${rows.join(', ')}
      ${ASSET_UPSERT_CONFLICT_TARGET}
      ${setClauses.join(', ')},
      "currentPrice" = COALESCE(EXCLUDED."currentPrice", "asset"."currentPrice"),
      "updatedAt" = now()
      WHERE (
        ${ASSET_UPSERT_COLUMNS.filter((c) => c !== 'coinGeckoId')
          .map((c) =>
            c === 'currentPrice'
              ? `"asset"."${c}" IS DISTINCT FROM COALESCE(EXCLUDED."${c}", "asset"."${c}")`
              : `"asset"."${c}" IS DISTINCT FROM EXCLUDED."${c}"`
          )
          .join(' OR ')}
      )
    `;
  }

  private flatten(
    batch: AssetSyncData[]
  ): Array<string | number | Date | null> {
    const params: Array<string | number | Date | null> = [];

    for (const asset of batch) {
      for (const column of ASSET_UPSERT_COLUMNS) {
        params.push(asset[column]);
      }
    }

    return params;
  }

  async findById(id: string): Promise<Asset | null> {
    return this.assetRepo.findOneBy({ id });
  }

  /**
   * Lists assets ordered by market-cap rank (most prominent first), so a
   * consumer that takes only the first page — the transaction form's asset
   * selector never pages beyond one — sees the actual top-ranked matches
   * rather than an arbitrary slice. Unranked assets (`marketCapRank IS NULL`)
   * sort after every ranked one; `id` breaks ties deterministically,
   * including between two unranked rows.
   */
  async list(options: {
    search: string;
    cursor: AssetListCursor | null;
    limit: number;
  }): Promise<Asset[]> {
    const qb = this.assetRepo.createQueryBuilder('asset');

    if (options.search) {
      qb.where(
        '(asset.symbol ILIKE :q OR asset.name ILIKE :q OR asset.coinGeckoId ILIKE :q)',
        { q: `%${options.search}%` }
      );
    }

    if (options.cursor) {
      qb.andWhere(this.cursorCondition(options.cursor), {
        cursorRank: options.cursor.marketCapRank,
        cursorId: options.cursor.id
      });
    }

    return qb
      .orderBy('asset.marketCapRank', 'ASC', 'NULLS LAST')
      .addOrderBy('asset.id', 'ASC')
      .take(options.limit)
      .getMany();
  }

  /**
   * "Strictly after" `cursor` under the same ordering `list()` sorts by.
   *
   * When the cursor row was ranked, the next rows are: a higher rank, the same
   * rank with a later id, or any unranked row (every unranked row sorts after
   * every ranked one). When the cursor row was itself unranked, the next rows
   * are the remaining unranked rows with a later id — there is nothing after
   * it among ranked rows.
   */
  private cursorCondition(cursor: AssetListCursor): string {
    if (cursor.marketCapRank === null) {
      return 'asset.marketCapRank IS NULL AND asset.id > :cursorId';
    }

    return (
      '(asset.marketCapRank > :cursorRank)' +
      ' OR (asset.marketCapRank = :cursorRank AND asset.id > :cursorId)' +
      ' OR asset.marketCapRank IS NULL'
    );
  }
}
