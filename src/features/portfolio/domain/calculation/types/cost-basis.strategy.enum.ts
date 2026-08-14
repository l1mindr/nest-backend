/**
 * The cost-basis policy used by the calculation engine.
 *
 * `AVERAGE` pools all acquisition cost and releases a proportional share on
 * disposal; `FIFO` and `LIFO` consume identified lots in acquisition order
 * (oldest first / newest first). The engine accepts this enum or a concrete
 * `CostBasisCalculator` instance.
 */
export enum CostBasisStrategy {
  AVERAGE = 'AVERAGE',
  FIFO = 'FIFO',
  LIFO = 'LIFO'
}
