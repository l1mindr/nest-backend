/**
 * Domain error codes for the portfolio calculation engine.
 *
 * These are deliberately separate from `PortfolioErrorCode`: the calculation
 * domain is HTTP-agnostic and never maps its failures to HTTP status codes.
 * The application layer is responsible for translating them into API errors.
 */
export enum CalculationErrorCode {
  INVALID_INPUT = 'CALCULATION_INVALID_INPUT',
  INVALID_DECIMAL = 'CALCULATION_INVALID_DECIMAL',
  INVALID_DATE = 'CALCULATION_INVALID_DATE',
  NEGATIVE_QUANTITY = 'CALCULATION_NEGATIVE_QUANTITY',
  NEGATIVE_AMOUNT = 'CALCULATION_NEGATIVE_AMOUNT',
  NEGATIVE_PRICE = 'CALCULATION_NEGATIVE_PRICE',
  NEGATIVE_FEE = 'CALCULATION_NEGATIVE_FEE',
  MISSING_PRICE = 'CALCULATION_MISSING_PRICE',
  INSUFFICIENT_QUANTITY = 'CALCULATION_INSUFFICIENT_QUANTITY',
  UNSUPPORTED_TRANSACTION_TYPE = 'CALCULATION_UNSUPPORTED_TRANSACTION_TYPE'
}
