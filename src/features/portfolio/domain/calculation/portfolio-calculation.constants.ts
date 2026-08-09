/**
 * Precision bound used when a derived quotient (e.g. `averageCost`) is
 * non-terminating. Terminating quotients are always returned exactly; this cap
 * only truncates infinite decimal expansions.
 *
 * The value mirrors the domain's maximum monetary scale: `amount` carries at
 * most 18 fractional digits and `price` at most 8, so `amount × price` (and
 * therefore any accumulated cost) carries at most 26. Truncating a
 * non-terminating average-cost quotient at 26 digits keeps the error below
 * `10^-26`, far beyond any storage or presentation precision.
 */
export const CALCULATION_DIVISION_MAX_FRACTION_DIGITS = 26;
