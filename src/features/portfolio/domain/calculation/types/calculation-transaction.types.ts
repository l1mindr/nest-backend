export enum CalculationTransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT'
}

/**
 * A transaction as consumed by the calculation engine.
 *
 * This is the normalized, database-independent view of a ledger entry. The
 * engine deliberately does not know about TypeORM entities, repositories or
 * DTOs. Only BUY, SELL, TRANSFER_IN and TRANSFER_OUT are part of the
 * calculation vocabulary; DEPOSIT and WITHDRAWAL are rejected by the
 * calculator even if a raw value somehow reaches it.
 */
export interface CalculationTransaction {
  /**
   * Opaque identifier used only as a deterministic ordering tie-breaker when
   * two transactions share the same `occurredAt`.
   */
  id?: string;
  type: CalculationTransactionType;
  /**
   * Quantity the transaction concerns, as a decimal string. Strictly positive.
   */
  amount: string;
  /**
   * Price per unit, as a decimal string. Required for BUY and SELL; optional
   * for transfers. For a TRANSFER_IN or TRANSFER_OUT this value is preserved
   * but never interpreted as acquisition cost: transfers do not create cost
   * basis, and no market price is invented for them.
   */
  price?: string;
  /**
   * Fee paid, as a non-negative decimal string. Preserved separately and never
   * merged into acquisition cost; the future realized-P&L policy decides the
   * exact accounting treatment.
   */
  fee?: string;
  /**
   * ISO 8601 timestamp. Used only for chronological ordering; never used in a
   * monetary calculation.
   */
  occurredAt: string;
}
