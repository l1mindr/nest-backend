import { PaginatedResult } from '@core/pagination/paginated-result.interface';
import type { EntityManager } from 'typeorm';
import { Coin } from '../../domain/entities/coin.entity';
import { PriceAlert } from '../../domain/entities/price-alert.entity';
import { AlertDirection } from '../../domain/enums/alert-direction.enum';
import { AlertStatus } from '../../domain/enums/alert-status.enum';
import { AlertTriggerMode } from '../../domain/enums/alert-trigger-mode.enum';
import { CoinSortField } from '../../domain/enums/coin-sort-field.enum';
import { NotificationChannel } from '../../domain/enums/notification-channel.enum';
import { SortOrder } from '../../domain/enums/sort-order.enum';
import { CreatePriceAlertRequestDto } from '../../presentation/dto/request/create-price-alert.request.dto';
import { UpdatePriceAlertRequestDto } from '../../presentation/dto/request/update-price-alert.request.dto';

export interface CoinSyncData {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  isActive: boolean;
  lastSyncedAt: Date;
}

export interface CoinCursor {
  sortBy: CoinSortField;
  sortOrder: SortOrder;
  value: string;
  id: string;
}

export interface CreatePriceAlertData {
  userId: string;
  coinId: string;
  direction: AlertDirection;
  targetPrice: string;
  triggerMode: AlertTriggerMode;
  expiresAt: Date | null;
  notificationChannels: NotificationChannel[];
}

export interface UpdatePriceAlertData {
  targetPrice?: string;
  direction?: AlertDirection;
  triggerMode?: AlertTriggerMode;
  expiresAt?: Date | null;
  notificationChannels?: NotificationChannel[];
  status?: AlertStatus;
  lastCheckedPrice?: string | null;
}

export interface ExpiredPriceAlert {
  id: string;
  userId: string;
  coinId: string;
}

export interface NotificationPayload {
  alertId: string;
  userId: string;
  /**
   * Resolved by the caller from the alert's owner. Carried here rather than
   * looked up again so that one query per scheduler page answers both "which
   * alerts fired" and "who hears about it".
   */
  recipientEmail: string;
  coinId: string;
  coinName: string;
  coinSymbol: string;
  direction: AlertDirection;
  targetPrice: string;
  currentPrice: string;
  /** The instant the crossing was detected; identifies this trigger occasion. */
  triggeredAt: Date;
}

export const COIN_REPOSITORY = Symbol('ICoinRepository');

export interface ICoinRepository {
  upsertMany(coins: CoinSyncData[], manager?: EntityManager): Promise<void>;
  deactivateAll(manager?: EntityManager): Promise<void>;
  findActiveById(id: string): Promise<Coin | null>;
  search(options: {
    search: string;
    cursor: CoinCursor | null;
    limit: number;
    sortBy: CoinSortField;
    sortOrder: SortOrder;
  }): Promise<Coin[]>;
}

export const PRICE_ALERT_REPOSITORY = Symbol('IPriceAlertRepository');

export interface IPriceAlertRepository {
  create(
    data: CreatePriceAlertData,
    manager?: EntityManager
  ): Promise<PriceAlert>;
  findByIdAndUser(id: string, userId: string): Promise<PriceAlert | null>;
  listByUser(
    userId: string,
    options: {
      cursorId: string | null;
      limit: number;
      status?: AlertStatus;
      direction?: AlertDirection;
      coinId?: string;
    }
  ): Promise<PriceAlert[]>;
  expireActiveAlerts(now: Date): Promise<ExpiredPriceAlert[]>;
  findActiveCoinIdsForScheduler(): Promise<string[]>;
  findActiveAlertsForScheduler(options: {
    cursorId: string | null;
    limit: number;
  }): Promise<PriceAlert[]>;
  updateOwned(
    id: string,
    userId: string,
    data: UpdatePriceAlertData
  ): Promise<void>;
  markTriggered(
    id: string,
    options: {
      lastCheckedPrice: string;
      lastTriggeredAt: Date;
      status: AlertStatus;
    }
  ): Promise<boolean>;
  updateLastCheckedPrice(
    id: string,
    lastCheckedPrice: string
  ): Promise<boolean>;
}

export const COIN_CURSOR_SERVICE = Symbol('ICoinCursorService');

export interface ICoinCursorService {
  encode(coin: Coin, sortBy: CoinSortField, sortOrder: SortOrder): string;
  decode(
    cursor: string | undefined,
    sortBy: CoinSortField,
    sortOrder: SortOrder
  ): CoinCursor | null;
}

export const LIST_COINS_USE_CASE = Symbol('IListCoinsUseCase');

export interface IListCoinsUseCase {
  execute(options: {
    search?: string;
    cursor?: string;
    limit?: number;
    sortBy?: CoinSortField;
    sortOrder?: SortOrder;
  }): Promise<PaginatedResult<Coin>>;
}

export const SYNC_COINS_USE_CASE = Symbol('ISyncCoinsUseCase');

export interface ISyncCoinsUseCase {
  execute(): Promise<void>;
}

export const CREATE_PRICE_ALERT_USE_CASE = Symbol('ICreatePriceAlertUseCase');

export interface ICreatePriceAlertUseCase {
  execute(userId: string, dto: CreatePriceAlertRequestDto): Promise<PriceAlert>;
}

export const UPDATE_PRICE_ALERT_USE_CASE = Symbol('IUpdatePriceAlertUseCase');

export interface IUpdatePriceAlertUseCase {
  execute(
    alertId: string,
    userId: string,
    dto: UpdatePriceAlertRequestDto
  ): Promise<PriceAlert>;
}

export const CANCEL_PRICE_ALERT_USE_CASE = Symbol('ICancelPriceAlertUseCase');

export interface ICancelPriceAlertUseCase {
  execute(alertId: string, userId: string): Promise<void>;
}

export const LIST_PRICE_ALERTS_USE_CASE = Symbol('IListPriceAlertsUseCase');

export interface IListPriceAlertsUseCase {
  execute(
    userId: string,
    options: {
      cursor?: string;
      limit?: number;
      status?: AlertStatus;
      direction?: AlertDirection;
      coinId?: string;
    }
  ): Promise<PaginatedResult<PriceAlert>>;
}

export const PRICE_CHECK_SERVICE = Symbol('IPriceCheckService');

export interface IPriceCheckService {
  check(): Promise<void>;
}

export const NOTIFICATION_SERVICE = Symbol('INotificationService');

export interface INotificationService {
  sendEmail(params: NotificationPayload): Promise<void>;
  sendSms(params: NotificationPayload): Promise<void>;
}

export const COINGECKO_CLIENT = Symbol('ICoinGeckoClient');

export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image?: string | null;
}

export interface CoinGeckoPrice {
  [id: string]: { usd: number };
}

export interface ICoinGeckoClient {
  getCoins(): Promise<CoinGeckoCoin[]>;
  getPrices(ids: string[]): Promise<CoinGeckoPrice>;
}
