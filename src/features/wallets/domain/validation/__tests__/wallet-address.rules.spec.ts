import { WalletNetwork } from '../../enums/wallet-network.enum';
import { isValidWalletAddress } from '../wallet-address.rules';

describe('isValidWalletAddress', () => {
  const EVM = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
  const BTC_LEGACY = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';
  const BTC_BECH32 = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
  const SOLANA = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
  const TRON = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE';

  it.each([
    [WalletNetwork.ETHEREUM, EVM],
    [WalletNetwork.BNB_CHAIN, EVM],
    [WalletNetwork.POLYGON, EVM],
    [WalletNetwork.ARBITRUM, EVM],
    [WalletNetwork.OPTIMISM, EVM],
    [WalletNetwork.AVALANCHE, EVM],
    [WalletNetwork.BASE, EVM],
    [WalletNetwork.BITCOIN, BTC_LEGACY],
    [WalletNetwork.BITCOIN, BTC_BECH32],
    [WalletNetwork.SOLANA, SOLANA],
    [WalletNetwork.TRON, TRON]
  ])('accepts a well-formed %s address', (network, address) => {
    expect(isValidWalletAddress(network, address)).toBe(true);
  });

  it('rejects an EVM address of the wrong length', () => {
    expect(isValidWalletAddress(WalletNetwork.ETHEREUM, '0xabc')).toBe(false);
    expect(isValidWalletAddress(WalletNetwork.ETHEREUM, `${EVM}00`)).toBe(
      false
    );
  });

  it('rejects an EVM address without the 0x prefix', () => {
    expect(isValidWalletAddress(WalletNetwork.ETHEREUM, EVM.slice(2))).toBe(
      false
    );
  });

  it('rejects non-hex characters in an EVM address', () => {
    expect(
      isValidWalletAddress(WalletNetwork.ETHEREUM, `0x${'z'.repeat(40)}`)
    ).toBe(false);
  });

  // The mistake this is really guarding against: a correct address pasted
  // under the wrong network.
  it('rejects an address belonging to a different network', () => {
    expect(isValidWalletAddress(WalletNetwork.BITCOIN, EVM)).toBe(false);
    expect(isValidWalletAddress(WalletNetwork.ETHEREUM, SOLANA)).toBe(false);
    expect(isValidWalletAddress(WalletNetwork.SOLANA, EVM)).toBe(false);
    expect(isValidWalletAddress(WalletNetwork.TRON, BTC_LEGACY)).toBe(false);
  });

  it('rejects base58 addresses containing ambiguous glyphs', () => {
    expect(
      isValidWalletAddress(WalletNetwork.SOLANA, SOLANA.replace(/.$/, '0'))
    ).toBe(false);
  });

  it('accepts any non-blank value for OTHER, and rejects blanks', () => {
    expect(isValidWalletAddress(WalletNetwork.OTHER, 'some-chain:abc')).toBe(
      true
    );
    expect(isValidWalletAddress(WalletNetwork.OTHER, '   ')).toBe(false);
    expect(isValidWalletAddress(WalletNetwork.OTHER, '')).toBe(false);
  });

  it('rejects an unknown network outright', () => {
    expect(isValidWalletAddress('DOGECOIN' as WalletNetwork, EVM)).toBe(false);
  });
});
