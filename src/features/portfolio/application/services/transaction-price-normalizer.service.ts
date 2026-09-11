import {
  GET_USDT_TOMAN_USE_CASE,
  IGetUsdtTomanUseCase
} from '@features/market-overview/application/interfaces/usdt-toman.interface';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import {
  NormalizedTransactionPrice,
  normalizeTransactionPrice,
  usdToToman
} from '../../domain/pricing/transaction-price';
import { PortfolioErrors } from '../../domain/errors/portfolio-errors';
import { PortfolioTransactionType } from '../../domain/enums/portfolio-transaction-type.enum';
import {
  DEFAULT_TRANSACTION_PRICE_CURRENCY,
  TransactionPriceCurrency
} from '../../domain/enums/transaction-price-currency.enum';

/** The types that carry a price, and so the only ones a currency applies to. */
const PRICED_TYPES: readonly PortfolioTransactionType[] = [
  PortfolioTransactionType.BUY,
  PortfolioTransactionType.SELL
];

/**
 * Turns an entered price/fee pair into the USD figures the ledger stores.
 *
 * The rate comes from the existing USDT/Toman use case — the same failover
 * chain and cache behind `GET /v1/market/usdt-toman` — rather than from the
 * request. A client-supplied rate would let a caller record any USD cost basis
 * they liked for a given Toman price, so the number is never trusted from
 * outside even though the frontend shows the user a preview of it.
 *
 * A cached rate is fine here and is the common case: this converts a price the
 * user is entering by hand, so a value up to the cache TTL old is well inside
 * the precision of the exercise. A *stale* rate (every exchange down, an
 * expired entry served) is also accepted, because rejecting the transaction
 * would be the worse failure — but the rate that was actually used is written
 * onto the row either way.
 */
@Injectable()
export class TransactionPriceNormalizerService {
  constructor(
    @Inject(GET_USDT_TOMAN_USE_CASE)
    private readonly getUsdtToman: IGetUsdtTomanUseCase,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(TransactionPriceNormalizerService.name);
  }

  /**
   * Validates the currency against the transaction type and returns the
   * columns to persist.
   *
   * `priceCurrency` defaults to USD when the caller omits it, so every existing
   * client keeps working untouched and an omitted field can never be read as a
   * request to convert.
   */
  async normalize(input: {
    type: PortfolioTransactionType;
    price: string | null;
    fee: string | null;
    priceCurrency?: TransactionPriceCurrency;
  }): Promise<NormalizedTransactionPrice> {
    const priceCurrency =
      input.priceCurrency ?? DEFAULT_TRANSACTION_PRICE_CURRENCY;

    if (
      priceCurrency !== DEFAULT_TRANSACTION_PRICE_CURRENCY &&
      !PRICED_TYPES.includes(input.type)
    ) {
      throw PortfolioErrors.transactionPriceCurrencyNotApplicable();
    }

    return normalizeTransactionPrice({
      price: input.price,
      fee: input.fee,
      priceCurrency,
      tomanPerUsdt:
        priceCurrency === TransactionPriceCurrency.TOMAN
          ? await this.resolveRate()
          : null
    });
  }

  /**
   * Recomputes the denomination columns for an edit.
   *
   * The values in the target currency come from the patch where it supplies
   * them, and otherwise from the transaction as it already reads *in that same
   * currency* — its entered values when the denomination is unchanged, or a
   * fresh conversion of the stored USD figures when the edit re-denominates.
   * That second path is what lets a currency switch on its own mean "show the
   * same trade in the other currency" rather than silently reinterpreting the
   * digits.
   *
   * Re-saving a Toman transaction re-stamps it at the current rate. The stored
   * rate is a record of the conversion actually applied, so it has to track the
   * conversion that produced the values now in the row.
   */
  async normalizeUpdate(input: {
    type: PortfolioTransactionType;
    price?: string | null;
    fee?: string | null;
    priceCurrency?: TransactionPriceCurrency;
    existing: {
      price: string | null;
      fee: string | null;
      priceCurrency: TransactionPriceCurrency;
      enteredPrice: string | null;
      enteredFee: string | null;
    };
  }): Promise<NormalizedTransactionPrice> {
    const { existing } = input;
    const priceCurrency = input.priceCurrency ?? existing.priceCurrency;

    if (
      priceCurrency !== DEFAULT_TRANSACTION_PRICE_CURRENCY &&
      !PRICED_TYPES.includes(input.type)
    ) {
      throw PortfolioErrors.transactionPriceCurrencyNotApplicable();
    }

    const rate =
      priceCurrency === TransactionPriceCurrency.TOMAN
        ? await this.resolveRate()
        : null;

    const carried = (
      patched: string | null | undefined,
      entered: string | null,
      stored: string | null
    ): string | null => {
      if (patched !== undefined) return patched;
      if (priceCurrency === existing.priceCurrency) return entered ?? stored;

      return stored === null || rate === null
        ? stored
        : usdToToman(stored, rate);
    };

    return normalizeTransactionPrice({
      price: carried(input.price, existing.enteredPrice, existing.price),
      fee: carried(input.fee, existing.enteredFee, existing.fee),
      priceCurrency,
      tomanPerUsdt: rate
    });
  }

  /**
   * Reads the current USDT/Toman rate, or fails the transaction.
   *
   * There is no fallback denomination: treating an unconvertible Toman figure
   * as USD would silently record a price roughly 234,000× too low, which is
   * far worse than asking the user to retry.
   */
  private async resolveRate(): Promise<string> {
    try {
      const snapshot = await this.getUsdtToman.execute();

      if (snapshot.isStale) {
        this.logger.warn(
          {
            provider: snapshot.provider,
            fetchedAt: snapshot.fetchedAt,
            rate: snapshot.priceToman
          },
          'Converting a Toman transaction price at a stale USDT/Toman rate'
        );
      }

      return snapshot.priceToman;
    } catch (error) {
      this.logger.error(
        { err: error },
        'Cannot convert a Toman transaction price: no USDT/Toman rate available'
      );

      throw PortfolioErrors.transactionPriceRateUnavailable();
    }
  }
}
