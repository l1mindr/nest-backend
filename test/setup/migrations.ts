import { CreateUsersTable1700000000000 } from '../../src/infrastructure/databases/postgres/migrations/1700000000000-CreateUsersTable';
import { CreateSessionsTable1700000001000 } from '../../src/infrastructure/databases/postgres/migrations/1700000001000-CreateSessionsTable';
import { CreateCoinAndPriceAlertTables1700000002000 } from '../../src/infrastructure/databases/postgres/migrations/1700000002000-CreateCoinAndPriceAlertTables';
import { CreateVerificationTable1700000003000 } from '../../src/infrastructure/databases/postgres/migrations/1700000003000-CreateVerificationTable';

/**
 * The runtime data source resolves migrations from a `dist/**` glob, which is
 * unavailable to ts-jest. They are listed explicitly here instead so the E2E
 * worker databases can be migrated from source.
 *
 * New migrations must be appended to this list, in timestamp order.
 */
export const E2E_MIGRATIONS = [
  CreateUsersTable1700000000000,
  CreateSessionsTable1700000001000,
  CreateCoinAndPriceAlertTables1700000002000,
  CreateVerificationTable1700000003000
];
