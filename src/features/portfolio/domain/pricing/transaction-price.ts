import {
  compareDecimals,
  divideDecimals,
  multiplyDecimals
} from '@core/decimal/decimal.util';
import { TransactionPriceCurrency } from '../enums/transaction-price-currency.enum';

/**
 * Fractional digits kept when converting into USD.
 *
 * Matches the `numeric(30,8)` scale of the `price`/`fee` columns, so the value
 * this produces is the value Postgres stores — converting at a finer scale
 * would only be rounded away on write, and at a coarser one would throw away
 * digits the column could have held. `divideDecimals` truncates rather than
 * rounds, so no half-cent is ever invented.
 */
export const USD_CONVERSION_FRACTION_DIGITS = 8;

/** Price and fee as they will be stored: USD, plus the original entry. */
export interface NormalizedTransactionPrice {
  /** USD price per unit — what the cost-basis engine consumes. */
  price: string | null;
  /** USD fee. */
  fee: string | null;
  priceCurrency: TransactionPriceCurrency;
  /** The price as entered, kept only when a conversion happened. */
  enteredPrice: string | null;
  /** The fee as entered, kept only when a conversion happened. */
  enteredFee: string | null;
  /** Toman per 1 USDT applied, kept only when a conversion happened. */
  usdtTomanRate: string | null;
}

/**
 * Converts a Toman figure into USD at `tomanPerUsdt`.
 *
 * The rate is Toman per 1 USDT. USDT is the Toman market's dollar proxy — it
 * is what Iranian exchanges quote against — so dividing by it is what turns a
 * Toman price into the USD the portfolio is valued in.
 *
 * Exact decimal division throughout: a Toman price is a six- or seven-digit
 * integer and the rate is another, so doing this in `number` would start
 * shedding digits well before the eight decimal places the column keeps.
 */
export function tomanToUsd(value: string, tomanPerUsdt: string): string {
  return divideDecimals(value, tomanPerUsdt, USD_CONVERSION_FRACTION_DIGITS);
}

/**
 * The inverse of {@link tomanToUsd}, used when an edit re-denominates a
 * transaction into Toman without supplying a new price: the stored USD value
 * is restated in Toman at the given rate so the edit means "the same trade,
 * shown in the other currency".
 *
 * Exact multiplication, so no digit of the USD figure is lost on the way back.
 */
export function usdToToman(value: string, tomanPerUsdt: string): string {
  return multiplyDecimals(value, tomanPerUsdt);
}

/**
 * Maps an entered price/fee pair onto the columns the transaction stores.
 *
 * USD entries pass straight through with no original recorded — the entry and
 * the stored value are the same number there, and keeping a second copy would
 * give one fact two places to drift. Toman entries are converted, and the
 * originals plus the rate are preserved so the row can always be shown back in
 * the currency it was created in.
 *
 * `rate` is only consulted for a Toman entry; a USD transaction never needs a
 * market lookup and must not fail because one was unavailable.
 */
export function normalizeTransactionPrice(input: {
  price: string | null;
  fee: string | null;
  priceCurrency: TransactionPriceCurrency;
  tomanPerUsdt: string | null;
}): NormalizedTransactionPrice {
  const { price, fee, priceCurrency } = input;

  if (priceCurrency === TransactionPriceCurrency.USD) {
    return {
      price,
      fee,
      priceCurrency,
      enteredPrice: null,
      enteredFee: null,
      usdtTomanRate: null
    };
  }

  const tomanPerUsdt = input.tomanPerUsdt;

  if (tomanPerUsdt === null || compareDecimals(tomanPerUsdt, '0') !== 1) {
    throw new Error(
      'A positive USDT/Toman rate is required to convert a Toman price'
    );
  }

  return {
    price: price === null ? null : tomanToUsd(price, tomanPerUsdt),
    fee: fee === null ? null : tomanToUsd(fee, tomanPerUsdt),
    priceCurrency,
    enteredPrice: price,
    enteredFee: fee,
    usdtTomanRate: tomanPerUsdt
  };
}
