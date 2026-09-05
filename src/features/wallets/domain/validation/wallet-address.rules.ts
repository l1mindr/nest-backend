import { WalletNetwork } from '../enums/wallet-network.enum';

/**
 * Per-network address format rules.
 *
 * These check the shape an address must have on its chain — prefix, alphabet
 * and length — which is enough to reject a typo or an address pasted for the
 * wrong network, the two mistakes that actually happen here. They deliberately
 * stop short of verifying checksums (EIP-55 casing, base58check, bech32
 * polymod): that needs real cryptographic decoding, and neither this API nor
 * the frontend carries a library for it. An address that passes is
 * well-formed, not proven to exist.
 *
 * The frontend mirrors this table so a bad address is reported in the field
 * rather than as a rejected request; both sides must stay in step, which is
 * why the patterns live in one named place instead of inline in a DTO.
 */

/**
 * Base58 minus the four ambiguous glyphs (0, O, I, l) — the alphabet Bitcoin,
 * Solana and Tron all draw from.
 */
const BASE58 = '[1-9A-HJ-NP-Za-km-z]';

/**
 * Bech32's data alphabet: lowercase, minus 1, b, i and o.
 */
const BECH32 = '[02-9ac-hj-np-z]';

/**
 * Every EVM chain shares Ethereum's 20-byte hex account, so one rule covers
 * Ethereum and each L2/sidechain that reuses its address format.
 */
const EVM_PATTERN = /^0x[0-9a-fA-F]{40}$/;

const EVM_NETWORKS = [
  WalletNetwork.ETHEREUM,
  WalletNetwork.BNB_CHAIN,
  WalletNetwork.POLYGON,
  WalletNetwork.ARBITRUM,
  WalletNetwork.OPTIMISM,
  WalletNetwork.AVALANCHE,
  WalletNetwork.BASE
] as const;

/**
 * Legacy P2PKH/P2SH (base58, leading 1 or 3) or a native SegWit/Taproot
 * bech32 address (`bc1`). Both remain in everyday use, so both are accepted.
 */
const BITCOIN_PATTERN = new RegExp(
  `^([13]${BASE58}{25,34}|bc1${BECH32}{11,71})$`
);

/** An Ed25519 public key in base58 — 32 bytes, so 32-44 characters. */
const SOLANA_PATTERN = new RegExp(`^${BASE58}{32,44}$`);

/** Tron mainnet base58 addresses are a leading `T` plus 33 characters. */
const TRON_PATTERN = new RegExp(`^T${BASE58}{33}$`);

/**
 * `OTHER` names a chain this enum does not model, so its shape is unknown;
 * anything non-blank within the column's width is allowed.
 */
const OTHER_PATTERN = /^\S(?:.*\S)?$/;

export const WALLET_ADDRESS_PATTERNS: Record<WalletNetwork, RegExp> = {
  [WalletNetwork.BITCOIN]: BITCOIN_PATTERN,
  [WalletNetwork.SOLANA]: SOLANA_PATTERN,
  [WalletNetwork.TRON]: TRON_PATTERN,
  [WalletNetwork.OTHER]: OTHER_PATTERN,
  ...(Object.fromEntries(
    EVM_NETWORKS.map((network) => [network, EVM_PATTERN])
  ) as Record<(typeof EVM_NETWORKS)[number], RegExp>)
};

/** Human-readable shape, used in validation messages and API docs. */
export const WALLET_ADDRESS_HINTS: Record<WalletNetwork, string> = {
  [WalletNetwork.BITCOIN]:
    'a base58 address starting with 1 or 3, or a bech32 address starting with bc1',
  [WalletNetwork.SOLANA]: 'a base58 public key of 32 to 44 characters',
  [WalletNetwork.TRON]: 'a base58 address starting with T, 34 characters long',
  [WalletNetwork.OTHER]: 'any non-blank value',
  [WalletNetwork.ETHEREUM]: '0x followed by 40 hexadecimal characters',
  [WalletNetwork.BNB_CHAIN]: '0x followed by 40 hexadecimal characters',
  [WalletNetwork.POLYGON]: '0x followed by 40 hexadecimal characters',
  [WalletNetwork.ARBITRUM]: '0x followed by 40 hexadecimal characters',
  [WalletNetwork.OPTIMISM]: '0x followed by 40 hexadecimal characters',
  [WalletNetwork.AVALANCHE]: '0x followed by 40 hexadecimal characters',
  [WalletNetwork.BASE]: '0x followed by 40 hexadecimal characters'
};

/** Whether `address` is well-formed for `network`. */
export function isValidWalletAddress(
  network: WalletNetwork,
  address: string
): boolean {
  const pattern = WALLET_ADDRESS_PATTERNS[network];

  // An unknown network cannot be vouched for, so it is not accepted.
  if (!pattern) return false;

  return pattern.test(address);
}
