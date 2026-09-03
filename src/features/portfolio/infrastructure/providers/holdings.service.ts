import {
  ASSET_REPOSITORY,
  IAssetRepository
} from '@features/assets/application/interfaces/assets.interface';
import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  DerivedHolding,
  HOLDING_REPOSITORY,
  IHoldingRepository,
  IPortfolioOpeningBalanceRepository,
  IPortfolioTransactionRepository,
  PORTFOLIO_OPENING_BALANCE_REPOSITORY,
  PORTFOLIO_TRANSACTION_REPOSITORY
} from '../../application/interfaces/portfolio.interface';
import { HoldingsCalculator } from '../../domain/calculation/holdings.calculator';
import {
  CalculationTransaction,
  CalculationTransactionType
} from '../../domain/calculation/types/calculation-transaction.types';
import { PortfolioTransaction } from '../../domain/entities/portfolio-transaction.entity';

/**
 * Derives a stable, RFC-4122-shaped identifier for a derived holding.
 *
 * The holdings API documents `id` as a UUID, and a portfolio+asset pair must
 * keep the same id across requests so the UI can use it as a list key.
 */
export function derivedHoldingId(portfolioId: string, assetId: string): string {
  const hash = createHash('sha256')
    .update(`${portfolioId}:${assetId}`)
    .digest('hex');

  // Pin the version (5) and variant (8..b) nibbles so the result is a
  // well-formed UUID rather than an arbitrary 32-character hex string.
  const variant = ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);

  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    `5${hash.substring(13, 16)}`,
    `${variant}${hash.substring(17, 20)}`,
    hash.substring(20, 32)
  ].join('-');
}

/**
 * The single place portfolio holdings are derived from the transaction ledger.
 *
 * Holdings are never read from the `holding` table: listing, valuation and
 * oversell validation all resolve through this service, so they cannot report
 * different quantities for the same portfolio.
 */
@Injectable()
export class HoldingsService {
  private readonly calculator = new HoldingsCalculator();

  constructor(
    @Inject(PORTFOLIO_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: IPortfolioTransactionRepository,
    @Inject(PORTFOLIO_OPENING_BALANCE_REPOSITORY)
    private readonly openingBalanceRepository: IPortfolioOpeningBalanceRepository,
    @Inject(ASSET_REPOSITORY)
    private readonly assetRepository: IAssetRepository,
    @Inject(HOLDING_REPOSITORY)
    private readonly holdingRepository: IHoldingRepository
  ) {}

  /**
   * Net quantity for one ledger, in chronological order.
   *
   * @param openingQuantity - Opening balance anchoring the ledger, if any.
   */
  calculateQuantity(
    transactions: CalculationTransaction[],
    openingQuantity?: string
  ): string {
    return this.calculator.calculateQuantity(transactions, openingQuantity);
  }

  /** True when `currentQuantity` covers a SELL / TRANSFER_OUT of `sellQuantity`. */
  canSell(currentQuantity: string, sellQuantity: string): boolean {
    return this.calculator.validateSell(currentQuantity, sellQuantity);
  }

  /**
   * Current quantity of one asset in one portfolio.
   *
   * Anchored on the asset's opening balance, so oversell validation measures
   * against the same number the holdings endpoint reports.
   */
  async getAssetQuantity(
    portfolioId: string,
    assetId: string,
    userId: string
  ): Promise<string> {
    const [transactions, openingBalances] = await Promise.all([
      this.transactionRepository.listByPortfolioAndAsset(
        portfolioId,
        assetId,
        userId
      ),
      this.openingBalanceRepository.listByPortfolioAndUser(portfolioId, userId)
    ]);

    const opening = openingBalances.find(
      (balance) => balance.assetId === assetId
    );

    return this.calculateQuantity(
      transactions.map((transaction) => this.toCalculation(transaction)),
      opening?.openingQuantity
    );
  }

  /**
   * Current quantity of one asset, as if `excludeTransactionId` did not exist.
   *
   * Used to validate an in-place edit of a SELL/TRANSFER_OUT transaction: the
   * transaction being edited is still in the ledger `listByPortfolioAndAsset`
   * returns, so it must be excluded before replaying — otherwise its own old
   * amount would be double-counted against the new one being validated.
   */
  async getAssetQuantityExcluding(
    portfolioId: string,
    assetId: string,
    userId: string,
    excludeTransactionId: string
  ): Promise<string> {
    const [transactions, openingBalances] = await Promise.all([
      this.transactionRepository.listByPortfolioAndAsset(
        portfolioId,
        assetId,
        userId
      ),
      this.openingBalanceRepository.listByPortfolioAndUser(portfolioId, userId)
    ]);

    const opening = openingBalances.find(
      (balance) => balance.assetId === assetId
    );

    return this.calculateQuantity(
      transactions
        .filter((transaction) => transaction.id !== excludeTransactionId)
        .map((transaction) => this.toCalculation(transaction)),
      opening?.openingQuantity
    );
  }

  /**
   * Every asset position in a portfolio, derived from its ledger.
   *
   * Assets that only have an opening balance are included, so the result
   * always satisfies `opening + BUY + TRANSFER_IN - SELL - TRANSFER_OUT`.
<<<<<<< HEAD
<<<<<<< HEAD
   * Assets with a manually-created `holding` row and no ledger activity are
   * included as-is: the ledger is the source of truth once it has an entry
   * for that asset, but a plain holding is still a position until then.
=======
>>>>>>> 3037e4d (refactor(portfolio): derive holdings from transaction ledger)
=======
   * Assets with a manually-created `holding` row and no ledger activity are
   * included as-is: the ledger is the source of truth once it has an entry
   * for that asset, but a plain holding is still a position until then.
>>>>>>> cb990cf (feat(holdings): integrate holding repository for manual holdings support)
   */
  async getPortfolioHoldings(
    portfolioId: string,
    userId: string
  ): Promise<DerivedHolding[]> {
    const [transactions, openingBalances, manualHoldings] = await Promise.all([
      this.transactionRepository.listForPnl(portfolioId, userId),
      this.openingBalanceRepository.listByPortfolioAndUser(portfolioId, userId),
      this.holdingRepository.listForValuation(portfolioId)
    ]);

    const ledgers = new Map<string, CalculationTransaction[]>();

    for (const transaction of transactions) {
      const ledger = ledgers.get(transaction.assetId);

      if (ledger) {
        ledger.push(this.toCalculation(transaction));
      } else {
        ledgers.set(transaction.assetId, [this.toCalculation(transaction)]);
      }
    }

    const openingByAsset = new Map(
      openingBalances.map((balance) => [balance.assetId, balance])
    );

    // An opening balance with no transactions is still a position.
    const assetIds = [
      ...new Set([...ledgers.keys(), ...openingByAsset.keys()])
    ];

    // `listForPnl` projects only the asset columns P&L needs, so the full
    // asset is loaded here to keep the holdings response shape unchanged.
    const assets = await Promise.all(
      assetIds.map((assetId) => this.assetRepository.findById(assetId))
    );

    const holdings: DerivedHolding[] = [];

    assetIds.forEach((assetId, index) => {
      const asset = assets[index] ?? openingByAsset.get(assetId)?.asset;

      if (!asset) return;

      const ledger = ledgers.get(assetId) ?? [];
      const opening = openingByAsset.get(assetId);

      // `listForPnl` is ordered by occurredAt ASC, so the ledger's ends bound
      // the position's lifetime. Deriving the timestamps from stored data
      // keeps them stable across requests and restarts.
      const first = ledger[0]?.occurredAt;
      const last = ledger[ledger.length - 1]?.occurredAt;

      holdings.push({
        id: derivedHoldingId(portfolioId, assetId),
        portfolioId,
        assetId,
        amount: this.calculateQuantity(ledger, opening?.openingQuantity),
        notes: null,
        createdAt: first
          ? new Date(first)
          : (opening?.createdAt ?? new Date(0)),
        updatedAt: last ? new Date(last) : (opening?.updatedAt ?? new Date(0)),
        asset
      });
    });

    const derivedAssetIds = new Set(assetIds);

    // A manually-created holding for an asset the ledger has no opinion on
    // (no transactions, no opening balance) is still a position: fall back to
    // it so `POST /v1/holdings` positions remain visible once the ledger
    // becomes the primary source of truth for everything else.
    for (const holding of manualHoldings) {
      if (derivedAssetIds.has(holding.assetId)) continue;

      holdings.push({
        id: holding.id,
        portfolioId: holding.portfolioId,
        assetId: holding.assetId,
        amount: holding.amount,
        notes: holding.notes,
        createdAt: holding.createdAt,
        updatedAt: holding.updatedAt,
        asset: holding.asset
      });
    }

    return holdings;
  }

  private toCalculation(
    transaction: PortfolioTransaction
  ): CalculationTransaction {
    return {
      id: transaction.id,
      type: transaction.type as unknown as CalculationTransactionType,
      amount: transaction.amount,
      price: transaction.price ?? undefined,
      fee: transaction.fee ?? undefined,
      occurredAt: transaction.occurredAt.toISOString()
    };
  }
}
