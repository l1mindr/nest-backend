import { Wallet } from '../../../domain/entities/wallet.entity';
import { WalletNetwork } from '../../../domain/enums/wallet-network.enum';
import { CreateWalletUseCase } from '../create-wallet.use-case';

describe('CreateWalletUseCase', () => {
  const walletRepository = {
    create: jest.fn(),
    findByIdAndUser: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countTransactionReferences: jest.fn()
  };

  let useCase: CreateWalletUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateWalletUseCase(walletRepository as any);
  });

  it('creates a wallet with an empty address set when none is given', async () => {
    const created = { id: 'wallet-id' } as Wallet;
    walletRepository.create.mockResolvedValue(created);

    const result = await useCase.execute('user-id', { name: 'Ledger X' });

    expect(walletRepository.create).toHaveBeenCalledWith({
      userId: 'user-id',
      name: 'Ledger X',
      addresses: []
    });
    expect(result).toBe(created);
  });

  it('keeps every network address under the one wallet', async () => {
    walletRepository.create.mockResolvedValue({} as Wallet);

    await useCase.execute('user-id', {
      name: 'Ledger X',
      addresses: [
        {
          network: WalletNetwork.SOLANA,
          address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
        },
        {
          network: WalletNetwork.ETHEREUM,
          address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
        }
      ]
    });

    // One wallet carrying two addresses — not two wallets.
    expect(walletRepository.create).toHaveBeenCalledTimes(1);
    expect(walletRepository.create).toHaveBeenCalledWith({
      userId: 'user-id',
      name: 'Ledger X',
      addresses: [
        {
          network: WalletNetwork.SOLANA,
          address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
        },
        {
          network: WalletNetwork.ETHEREUM,
          address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
        }
      ]
    });
  });
});
