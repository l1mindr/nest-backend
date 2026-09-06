/**
 * The blockchain networks a wallet can hold an address on.
 *
 * This is the application's canonical network list — nothing else in the
 * codebase modelled networks before it. The `asset` table mirrors CoinGecko's
 * market data and carries no chain/platform column, so an asset cannot supply
 * this; a wallet's networks are a property of the wallet, not of the coins the
 * user happens to hold.
 *
 * Stored as a Postgres enum, and mirrored verbatim in the frontend's
 * `features/wallets/types.ts` — the same arrangement `PortfolioSourceType`
 * already uses, so a value added here surfaces as a TypeScript error there
 * rather than as a silently missing label.
 *
 * `OTHER` is the escape hatch: it accepts any non-empty address, so a chain
 * this list does not name yet is still recordable.
 */
export enum WalletNetwork {
  BITCOIN = 'BITCOIN',
  ETHEREUM = 'ETHEREUM',
  SOLANA = 'SOLANA',
  BNB_CHAIN = 'BNB_CHAIN',
  POLYGON = 'POLYGON',
  ARBITRUM = 'ARBITRUM',
  OPTIMISM = 'OPTIMISM',
  AVALANCHE = 'AVALANCHE',
  BASE = 'BASE',
  TRON = 'TRON',
  OTHER = 'OTHER'
}
