import { CreateUsersTable1700000000000 } from '../../src/infrastructure/databases/postgres/migrations/1700000000000-CreateUsersTable';
import { CreateSessionsTable1700000001000 } from '../../src/infrastructure/databases/postgres/migrations/1700000001000-CreateSessionsTable';
import { CreateCoinAndPriceAlertTables1700000002000 } from '../../src/infrastructure/databases/postgres/migrations/1700000002000-CreateCoinAndPriceAlertTables';
import { CreateVerificationTable1700000003000 } from '../../src/infrastructure/databases/postgres/migrations/1700000003000-CreateVerificationTable';
import { CreateVerificationCodeActiveLatestIndex1700000004000 } from '../../src/infrastructure/databases/postgres/migrations/1700000004000-CreateVerificationCodeActiveLatestIndex';
import { CreateAuthorizationTables1700000005000 } from '../../src/infrastructure/databases/postgres/migrations/1700000005000-CreateAuthorizationTables';
import { CreateAdminInvitationTable1700000006000 } from '../../src/infrastructure/databases/postgres/migrations/1700000006000-CreateAdminInvitationTable';
import { StandardizeDateTimeColumns1700000007000 } from '../../src/infrastructure/databases/postgres/migrations/1700000007000-StandardizeDateTimeColumns';
import { CreateAssetsTable1700000008000 } from '../../src/infrastructure/databases/postgres/migrations/1700000008000-CreateAssetsTable';
import { CreatePortfolioTables1700000009000 } from '../../src/infrastructure/databases/postgres/migrations/1700000009000-CreatePortfolioTables';
import { CreatePortfolioTransactionTable1700000010000 } from '../../src/infrastructure/databases/postgres/migrations/1700000010000-CreatePortfolioTransactionTable';
import { CreatePortfolioOpeningBalanceTable1700000011000 } from '../../src/infrastructure/databases/postgres/migrations/1700000011000-CreatePortfolioOpeningBalanceTable';
import { OptimizePortfolioTransactionIndexes1700000012000 } from '../../src/infrastructure/databases/postgres/migrations/1700000012000-OptimizePortfolioTransactionIndexes';
import { CreatePortfolioCalculationCheckpointTable1700000013000 } from '../../src/infrastructure/databases/postgres/migrations/1700000013000-CreatePortfolioCalculationCheckpointTable';
import { IncreaseAssetSupplyPrecision1700000014000 } from '../../src/infrastructure/databases/postgres/migrations/1700000014000-IncreaseAssetSupplyPrecision';
import { IncreaseAssetPricePrecision1700000015000 } from '../../src/infrastructure/databases/postgres/migrations/1700000015000-IncreaseAssetPricePrecision';
import { CreateRoleTables1700000016000 } from '../../src/infrastructure/databases/postgres/migrations/1700000016000-CreateRoleTables';
import { CreateWalletTable1700000017000 } from '../../src/infrastructure/databases/postgres/migrations/1700000017000-CreateWalletTable';
import { AddTransferDestinationToPortfolioTransaction1700000018000 } from '../../src/infrastructure/databases/postgres/migrations/1700000018000-AddTransferDestinationToPortfolioTransaction';
import { CreateWalletAddressTable1700000019000 } from '../../src/infrastructure/databases/postgres/migrations/1700000019000-CreateWalletAddressTable';

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
  CreateAdminInvitationTable1700000006000,
  StandardizeDateTimeColumns1700000007000,
  CreateAssetsTable1700000008000,
  CreatePortfolioTables1700000009000,
  CreatePortfolioTransactionTable1700000010000,
  CreatePortfolioOpeningBalanceTable1700000011000,
  OptimizePortfolioTransactionIndexes1700000012000,
  CreatePortfolioCalculationCheckpointTable1700000013000,
  IncreaseAssetSupplyPrecision1700000014000,
  IncreaseAssetPricePrecision1700000015000,
  CreateRoleTables1700000016000,
  CreateWalletTable1700000017000,
  AddTransferDestinationToPortfolioTransaction1700000018000,
  CreateWalletAddressTable1700000019000
];
