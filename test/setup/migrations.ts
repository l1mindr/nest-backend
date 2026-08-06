import { CreateUsersTable1700000000000 } from '../../src/infrastructure/databases/postgres/migrations/1700000000000-CreateUsersTable';
import { CreateSessionsTable1700000001000 } from '../../src/infrastructure/databases/postgres/migrations/1700000001000-CreateSessionsTable';
import { CreateCoinAndPriceAlertTables1700000002000 } from '../../src/infrastructure/databases/postgres/migrations/1700000002000-CreateCoinAndPriceAlertTables';
import { CreateVerificationTable1700000003000 } from '../../src/infrastructure/databases/postgres/migrations/1700000003000-CreateVerificationTable';
import { CreateVerificationCodeActiveLatestIndex1700000004000 } from '../../src/infrastructure/databases/postgres/migrations/1700000004000-CreateVerificationCodeActiveLatestIndex';
import { CreateAuthorizationTables1700000005000 } from '../../src/infrastructure/databases/postgres/migrations/1700000005000-CreateAuthorizationTables';
import { CreateAdminInvitationTable1700000006000 } from '../../src/infrastructure/databases/postgres/migrations/1700000006000-CreateAdminInvitationTable';

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
  CreateVerificationTable1700000003000,
  CreateVerificationCodeActiveLatestIndex1700000004000,
  CreateAuthorizationTables1700000005000,
  CreateAdminInvitationTable1700000006000
];
