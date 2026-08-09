import {
  compareDecimals,
  multiplyDecimals,
  subtractDecimals,
  sumDecimals
} from '@core/decimal/decimal.util';

/**
 * A single identified block of an asset held for FIFO/LIFO accounting.
 *
 * `quantity` is the remaining amount in the lot and `unitCost` the per-unit
 * acquisition cost. For lots created by a BUY, `unitCost` is exactly the BUY
 * price. For the opening position it is derived as `openingCost /
 * openingQuantity`, which may truncate a non-terminating expansion at the
 * domain division precision. Both values are non-negative decimal strings.
 */
export interface Lot {
  quantity: string;
  unitCost: string;
}

export interface ConsumeLotsResult {
  /**
   * The remaining lots after removal, in the original acquisition order —
   * regardless of which end the disposal consumed from.
   */
  remainingLots: Lot[];
  /** Total acquisition cost released from the consumed lots, as a decimal string. */
  releasedBasis: string;
}

/**
 * Removes `amount` from the lots, consuming them either from the front
 * (FIFO) or from the back (LIFO). Lots are never mutated: a fresh `Lot[]` is
 * returned and exhausted lots are dropped. The caller guarantees that `amount`
 * does not exceed the total held quantity.
 */
export function consumeLots(
  lots: Lot[],
  amount: string,
  fromBack: boolean
): ConsumeLotsResult {
  const consumeOrder = lots.map((_, index) => index);
  if (fromBack) {
    consumeOrder.reverse();
  }

  const consumedByIndex = new Map<number, string>();
  let remaining = amount;
  let releasedBasis = '0';

  for (const index of consumeOrder) {
    if (compareDecimals(remaining, '0') <= 0) {
      break;
    }
    const lot = lots[index];
    const consumed =
      compareDecimals(lot.quantity, remaining) <= 0 ? lot.quantity : remaining;
    consumedByIndex.set(index, consumed);
    releasedBasis = sumDecimals([
      releasedBasis,
      multiplyDecimals(consumed, lot.unitCost)
    ]);
    remaining = subtractDecimals(remaining, consumed);
  }

  const remainingLots: Lot[] = [];
  for (let index = 0; index < lots.length; index++) {
    const consumed = consumedByIndex.get(index) ?? '0';
    const leftover = subtractDecimals(lots[index].quantity, consumed);
    if (compareDecimals(leftover, '0') > 0) {
      remainingLots.push({
        quantity: leftover,
        unitCost: lots[index].unitCost
      });
    }
  }

  return { remainingLots, releasedBasis };
}
