import {
  compareDecimals,
  divideDecimals,
  isDecimalString
} from '@core/decimal/decimal.util';
import { MarketOverviewErrors } from '../../domain/errors/market-overview-errors';

/**
 * Cap on the fractional Toman digits kept when a quotient does not terminate.
 *
 * It does not bite for either venue in practice: dividing by a power of ten
 * always terminates, so a Rial quote converts exactly however many digits it
 * carries. The cap only exists so an odd `RIAL_PER_TOMAN` override cannot ask
 * for an infinite expansion. What matters either way is that the quotient is
 * truncated rather than rounded, matching `divideDecimals`.
 */
const TOMAN_FRACTION_DIGITS = 8;

/** Fixed scale of the 24h change, so both venues render it identically. */
const PERCENTAGE_FRACTION_DIGITS = 4;

/** How many Rial make one Toman — the divisor for a Rial-quoted market. */
export const RIAL_PER_TOMAN = '10';

/** A Toman-quoted market needs no conversion; the divisor is the identity. */
export const TOMAN_PER_TOMAN = '1';

/**
 * Accepts the numeric forms venues actually send — Nobitex quotes prices as
 * strings, Wallex sends its 24h change as a JSON number — and returns a
 * decimal string the exact-decimal helpers can parse, or `null` when the value
 * is not a finite decimal at all.
 *
 * A number is only accepted when its default rendering is already in plain
 * decimal notation: exponent forms like `1e+21` are not decimal strings, and
 * silently reinterpreting one would be worse than rejecting the payload.
 */
function decimalString(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;

    const rendered = String(value);

    return isDecimalString(rendered) ? rendered : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    return isDecimalString(trimmed) ? trimmed : null;
  }

  return null;
}

/**
 * Truncates a decimal string toward zero at `digits` fractional digits and
 * pads it back out to exactly that scale, so `'0.62'` and `'0.6200000'` both
 * render as `'0.6200'`. Pure string arithmetic — the value never passes
 * through a float.
 */
function quantize(value: string, digits: number): string {
  const negative = value.startsWith('-');
  const magnitude = negative ? value.slice(1) : value;
  const [integer, fraction = ''] = magnitude.split('.');
  const scaled = fraction.slice(0, digits).padEnd(digits, '0');
  const rendered = digits === 0 ? integer : `${integer}.${scaled}`;

  // '-0.0000' is not a meaningful change, so a value that truncates away to
  // nothing loses its sign rather than rendering as negative zero.
  const isZero = /^0+$/.test(integer) && /^0*$/.test(scaled);

  return negative && !isZero ? `-${rendered}` : rendered;
}

/**
 * Converts a venue's quoted USDT price into Toman.
 *
 * `quotedPerToman` is how many units of the venue's quote currency make one
 * Toman — {@link RIAL_PER_TOMAN} for a Rial market, {@link TOMAN_PER_TOMAN}
 * for one already priced in Toman. The division runs through the project's
 * exact decimal helpers, so a Rial price is never round-tripped through a JS
 * float the way `latest / 10` would.
 *
 * Malformed, zero and negative prices are all rejected as invalid responses:
 * a venue that reports a non-positive USDT rate is broken, and passing that on
 * would be worse than failing over to the other exchange.
 */
export function toTomanPrice(value: unknown, quotedPerToman: string): string {
  const raw = decimalString(value);

  if (raw === null || compareDecimals(raw, '0') !== 1) {
    throw MarketOverviewErrors.providerInvalidResponse();
  }

  return divideDecimals(raw, quotedPerToman, TOMAN_FRACTION_DIGITS);
}

/**
 * Normalises a venue's 24h change into a fixed-scale percentage string.
 *
 * Unlike the price, a missing change degrades to zero rather than failing the
 * whole rate — the tile can show a price without a trend, and both venues
 * treat the field as optional. Negative changes are expected and preserved.
 */
export function toPercentageChange(value: unknown): string {
  const raw = decimalString(value);

  if (raw === null) {
    return quantize('0', PERCENTAGE_FRACTION_DIGITS);
  }

  return quantize(raw, PERCENTAGE_FRACTION_DIGITS);
}
