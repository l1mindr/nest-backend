import type { PaginatedResult } from '@core/pagination/paginated-result.interface';
import type { Asset } from '../../domain/entities/asset.entity';

export const COINGECKO_PORT = Symbol('CoinGeckoPort');

export interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  total_volume?: number;
  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number;
  price_change_24h?: number;
  price_change_percentage_24h?: number;
  last_updated?: string;
}

export interface CoinGeckoPort {
  fetchMarketData(): Promise<CoinGeckoMarketData[]>;
}

export interface AssetSyncData {
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
  lastSyncedAt: Date;
}

export const ASSET_REPOSITORY = Symbol('IAssetRepository');

export interface IAssetRepository {
  upsertMany(data: AssetSyncData[]): Promise<void>;
  findById(id: string): Promise<Asset | null>;
  list(options: {
    search: string;
    cursorId: string | null;
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
