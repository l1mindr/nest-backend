import type { PaginatedResult } from '@core/pagination/paginated-result.interface';
import type { Asset } from '../../domain/entities/asset.entity';

export const MARKET_DATA_PORT = Symbol('MarketDataPort');

/**
 * One asset as reported by the external market data source, already mapped to
 * the application's vocabulary. Decimal quantities are decimal strings; `null`
 * means the provider did not report a value. Providers (e.g. CoinGecko) are
 * responsible for turning their own wire format into this shape.
 */
export interface MarketDataEntry {
  coinGeckoId: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  currentPrice: string | null;
  marketCap: string | null;
  marketCapRank: number | null;
  totalVolume: string | null;
  circulatingSupply: string | null;
  totalSupply: string | null;
  maxSupply: string | null;
  priceChange24h: string | null;
  priceChangePercentage24h: string | null;
}

export interface MarketDataPort {
  fetchMarketData(): Promise<MarketDataEntry[]>;
}

export interface AssetSyncData extends MarketDataEntry {
  lastSyncedAt: Date;
}

export const ASSET_REPOSITORY = Symbol('IAssetRepository');

/**
 * Position within the market-cap-rank ordering that `list()` paginates over.
 * `marketCapRank` mirrors the row it was produced from (`null` sorts after
 * every ranked asset), and `id` breaks ties (including between two rows that
 * both have a `null` rank).
 */
export interface AssetListCursor {
  marketCapRank: number | null;
  id: string;
}

export interface IAssetRepository {
  upsertMany(data: AssetSyncData[]): Promise<void>;
  findById(id: string): Promise<Asset | null>;
  list(options: {
    search: string;
    cursor: AssetListCursor | null;
    limit: number;
  }): Promise<Asset[]>;
}

export const SYNC_ASSETS_USE_CASE = Symbol('ISyncAssetsUseCase');

export interface SyncAssetsResult {
  receivedCount: number;
  synchronizedCount: number;
}

export interface ISyncAssetsUseCase {
  execute(): Promise<SyncAssetsResult>;
}

export const GET_ASSET_USE_CASE = Symbol('IGetAssetUseCase');

export interface IGetAssetUseCase {
  execute(assetId: string): Promise<Asset>;
}

export const LIST_ASSETS_USE_CASE = Symbol('IListAssetsUseCase');

export interface IListAssetsUseCase {
  execute(options: {
    search?: string;
    cursor?: string;
    limit?: number;
  }): Promise<PaginatedResult<Asset>>;
}
