import { CalculationErrorCode } from './calculation-error-code.enum';

/**
 * A domain failure of the calculation engine. Carries a machine-readable code
 * and an optional field name. No HTTP status is attached: the engine is
 * HTTP-agnostic and the application layer maps these to API errors later.
 */
export class CalculationError extends Error {
  constructor(
    public readonly code: CalculationErrorCode,
    public readonly field?: string,
    message?: string
  ) {
    super(message ?? code);
    this.name = 'CalculationError';
  }
}

export class CalculationErrors {
  static invalidInput(message = 'Calculation input is invalid') {
    return new CalculationError(
      CalculationErrorCode.INVALID_INPUT,
      undefined,
      message
    );
  }

  static invalidDecimal(field: string) {
    return new CalculationError(
      CalculationErrorCode.INVALID_DECIMAL,
      field,
      `Invalid decimal string for ${field}`
    );
  }

  static invalidDate() {
    return new CalculationError(
      CalculationErrorCode.INVALID_DATE,
      'occurredAt',
      'Transaction occurredAt must be a valid ISO 8601 timestamp'
    );
  }

  static negativeQuantity() {
    return new CalculationError(
      CalculationErrorCode.NEGATIVE_QUANTITY,
      'quantity',
      'Quantity must not be negative'
    );
  }

  static negativeAmount() {
    return new CalculationError(
      CalculationErrorCode.NEGATIVE_AMOUNT,
      'amount',
      'Amount must be greater than zero'
    );
  }

  static negativePrice() {
    return new CalculationError(
      CalculationErrorCode.NEGATIVE_PRICE,
      'price',
      'Price must be greater than zero when present'
    );
  }

  static negativeFee() {
    return new CalculationError(
      CalculationErrorCode.NEGATIVE_FEE,
      'fee',
      'Fee must not be negative'
    );
  }

  static missingPrice(type: string) {
    return new CalculationError(
      CalculationErrorCode.MISSING_PRICE,
      'price',
      `${type} transactions require a price`
    );
  }

  static insufficientQuantity() {
    return new CalculationError(
      CalculationErrorCode.INSUFFICIENT_QUANTITY,
      'amount',
      'Transaction amount exceeds the available quantity'
    );
  }

  static unsupportedTransactionType(type: unknown) {
    return new CalculationError(
      CalculationErrorCode.UNSUPPORTED_TRANSACTION_TYPE,
      'type',
      `Unsupported transaction type: ${String(type)}`
    );
  }
}
