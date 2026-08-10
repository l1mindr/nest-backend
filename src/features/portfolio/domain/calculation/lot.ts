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
 * Exhausted FIFO prefixes are only compacted away once the head pointer has
 * advanced past this many lots and covers at least half of the array. Delaying
 * the compaction keeps each disposal amortized O(1) while bounding the space
 * held by exhausted lots.
 */
const COMPACTION_THRESHOLD = 1024;

/**
 * Mutable lot accounting used by the FIFO/LIFO calculators.
 *
 * Lots are appended in acquisition order. A disposal consumes from the front
 * (FIFO) or the back (LIFO) by advancing a head pointer or popping the tail,
 * so a disposal only touches the lots it actually consumes instead of
 * rebuilding the whole remaining-lot array. Pushed lots are copied, so the
 * store never aliases caller-owned objects.
 */
export class LotStore {
  private readonly lots: Lot[] = [];
  private head = 0;

  constructor(private readonly fromBack: boolean) {}

  /**
   * Appends a lot at the newest position.
   */
  push(lot: Lot): void {
    this.lots.push({ quantity: lot.quantity, unitCost: lot.unitCost });
  }

  /**
   * Consumes `amount` from the configured end and returns the exact cost basis
   * released. The caller guarantees that `amount` does not exceed the held
   * quantity.
   */
  consume(amount: string): string {
    if (compareDecimals(amount, '0') <= 0) {
      return '0';
    }

    let remaining = amount;
    let releasedBasis = '0';

    while (this.lots.length > this.head) {
      const index = this.fromBack ? this.lots.length - 1 : this.head;
      const lot = this.lots[index];
      const consumed =
        compareDecimals(lot.quantity, remaining) <= 0
          ? lot.quantity
          : remaining;
      releasedBasis = sumDecimals([
        releasedBasis,
        multiplyDecimals(consumed, lot.unitCost)
      ]);
      remaining = subtractDecimals(remaining, consumed);
      lot.quantity = subtractDecimals(lot.quantity, consumed);
      if (compareDecimals(lot.quantity, '0') === 0) {
        if (this.fromBack) {
          this.lots.pop();
        } else {
          this.head += 1;
        }
      }
      if (compareDecimals(remaining, '0') === 0) {
        break;
      }
    }

    if (!this.fromBack) {
      this.compact();
    }
    return releasedBasis;
  }

  /**
   * The remaining lots after consumption, in original acquisition order.
   */
  toLots(): Lot[] {
    return this.lots.slice(this.head).map((lot) => ({
      quantity: lot.quantity,
      unitCost: lot.unitCost
    }));
  }

  private compact(): void {
    if (this.head > COMPACTION_THRESHOLD && this.head * 2 >= this.lots.length) {
      this.lots.splice(0, this.head);
      this.head = 0;
    }
  }
}

/**
 * Pure convenience wrapper over `LotStore`. Removes `amount` from the lots,
 * consuming them either from the front (FIFO) or from the back (LIFO). Lots
 * are never mutated: a fresh `Lot[]` is returned and exhausted lots are
 * dropped. The caller guarantees that `amount` does not exceed the total held
 * quantity.
 */
export function consumeLots(
  lots: Lot[],
  amount: string,
  fromBack: boolean
): ConsumeLotsResult {
  const store = new LotStore(fromBack);
  for (const lot of lots) {
    store.push(lot);
  }
  const releasedBasis = store.consume(amount);
  return {
    remainingLots: store.toLots(),
    releasedBasis
  };
}
