/**
 * The currency a user entered a transaction's price and fee in.
 *
 * This is an *input* denomination, not a valuation currency: whatever is
 * chosen here, the transaction is normalized to USD before it reaches the
 * cost-basis engine, because `PORTFOLIO_VALUATION_CURRENCY` is USD and every
 * position is valued against a USD market price. It exists so the value the
 * user actually typed can be shown back to them unchanged, and so the
 * conversion that produced the stored USD figure is auditable.
 *
 * One field covers both price and fee deliberately. A transaction is paid for
 * in one currency; letting the two diverge would allow a Toman price with a
 * USD fee, which no exchange produces and which the UI has no way to express.
 */
export enum TransactionPriceCurrency {
  USD = 'USD',
  TOMAN = 'TOMAN'
}

/** The denomination assumed for every transaction recorded before this existed. */
export const DEFAULT_TRANSACTION_PRICE_CURRENCY = TransactionPriceCurrency.USD;
