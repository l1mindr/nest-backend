import { compareDecimals, isDecimalString } from '@core/decimal/decimal.util';
import { CalculationErrors } from './errors/calculation-errors';
import { CalculationTransactionType } from './types/calculation-transaction.types';

/**
 * Shared validation for every cost-basis strategy. The strategies all consume
 * the same transaction vocabulary and enforce the same value constraints, so
 * the guards live here instead of being duplicated across the average, FIFO
 * and LIFO implementations.
 */

export function assertSupportedType(
  type: unknown
): asserts type is CalculationTransactionType {
  if (
    type !== CalculationTransactionType.BUY &&
    type !== CalculationTransactionType.SELL &&
    type !== CalculationTransactionType.TRANSFER_IN &&
    type !== CalculationTransactionType.TRANSFER_OUT
  ) {
    throw CalculationErrors.unsupportedTransactionType(type);
  }
}

export function assertOpeningQuantity(value: string): string {
  if (!isDecimalString(value)) {
    throw CalculationErrors.invalidDecimal('openingQuantity');
  }
  if (compareDecimals(value, '0') < 0) {
    throw CalculationErrors.negativeQuantity();
  }
  return value;
}

export function assertOpeningCost(value: string): string {
  if (!isDecimalString(value)) {
    throw CalculationErrors.invalidDecimal('openingCost');
  }
  if (compareDecimals(value, '0') < 0) {
    throw CalculationErrors.negativeAmount();
  }
  return value;
}

export function assertPositiveAmount(amount: string): string {
  if (!isDecimalString(amount)) {
    throw CalculationErrors.invalidDecimal('amount');
  }
  if (compareDecimals(amount, '0') <= 0) {
    throw CalculationErrors.negativeAmount();
  }
  return amount;
}

export function requirePrice(
  price: string | undefined,
  type: CalculationTransactionType
): string {
  if (price === undefined) {
    throw CalculationErrors.missingPrice(type);
  }
  if (!isDecimalString(price)) {
    throw CalculationErrors.invalidDecimal('price');
  }
  if (compareDecimals(price, '0') <= 0) {
    throw CalculationErrors.negativePrice();
  }
  return price;
}

export function assertOptionalPrice(price: string | undefined): void {
  if (price === undefined) {
    return;
  }
  if (!isDecimalString(price)) {
    throw CalculationErrors.invalidDecimal('price');
  }
  if (compareDecimals(price, '0') <= 0) {
    throw CalculationErrors.negativePrice();
  }
}

export function assertFee(fee: string | undefined): void {
  if (fee === undefined) {
    return;
  }
  if (!isDecimalString(fee)) {
    throw CalculationErrors.invalidDecimal('fee');
  }
  if (compareDecimals(fee, '0') < 0) {
    throw CalculationErrors.negativeFee();
  }
}

/**
 * Guards a disposal (SELL/TRANSFER_OUT) against the available quantity. The
 * held quantity is never allowed to go negative.
 */
export function assertAvailable(quantity: string, amount: string): void {
  if (compareDecimals(amount, quantity) > 0) {
    throw CalculationErrors.insufficientQuantity();
  }
}
