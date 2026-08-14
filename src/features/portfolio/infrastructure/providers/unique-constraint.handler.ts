import { PortfolioErrors } from '../../domain/errors/portfolio-errors';

interface DriverError {
  code?: string;
  constraint?: string;
  detail?: string;
}

const HOLDING_UNIQUE_INDEX = 'IDX_holding_portfolio_asset';

/**
 * Re-maps the PostgreSQL unique-index violation raised when two holdings for
 * the same (portfolio, asset) are written concurrently. The use case checks for
 * a duplicate before inserting; this closes the race between the check and the
 * insert.
 */
export function throwOnHoldingUniqueConstraint(error: unknown): never {
  const driverError = extractDriverError(error);

  if (
    driverError &&
    driverError.code === '23505' &&
    (driverError.constraint === HOLDING_UNIQUE_INDEX ||
      driverError.detail?.includes(HOLDING_UNIQUE_INDEX))
  ) {
    throw PortfolioErrors.holdingAlreadyExists();
  }

  throw error;
}

function extractDriverError(error: unknown): DriverError | null {
  if (typeof error !== 'object' || error === null) return null;

  const candidate = (error as { driverError?: unknown }).driverError ?? error;

  if (typeof candidate !== 'object' || candidate === null) return null;

  return candidate as DriverError;
}
