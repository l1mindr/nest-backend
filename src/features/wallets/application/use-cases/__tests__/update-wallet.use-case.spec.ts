import { Wallet } from '../../../domain/entities/wallet.entity';
import { WalletErrorCode } from '../../../domain/errors/wallet-error-code.enum';
import { WalletNetwork } from '../../../domain/enums/wallet-network.enum';
import { UpdateWalletUseCase } from '../update-wallet.use-case';

describe('UpdateWalletUseCase', () => {
  const walletRepository = {
    create: jest.fn(),
    findByIdAndUser: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countTransactionReferences: jest.fn()
  };

  let useCase: UpdateWalletUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new UpdateWalletUseCase(walletRepository as any);
  });

  it('renames without touching the address set', async () => {
    const updated = { id: 'wallet-id', name: 'Ledger Nano S' } as Wallet;
    walletRepository.update.mockResolvedValue(updated);

    const result = await useCase.execute('wallet-id', 'user-id', {
      name: 'Ledger Nano S'
    });

    expect(walletRepository.update).toHaveBeenCalledWith(
      'wallet-id',
      'user-id',
      { name: 'Ledger Nano S' }
    );
    expect(result).toBe(updated);
  });

  it('passes the address set through as the wallet’s complete new set', async () => {
    walletRepository.update.mockResolvedValue({} as Wallet);

    await useCase.execute('wallet-id', 'user-id', {
      addresses: [
        {
          network: WalletNetwork.BITCOIN,
          address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
        }
      ]
    });

    expect(walletRepository.update).toHaveBeenCalledWith(
      'wallet-id',
      'user-id',
      {
        addresses: [
          {
            network: WalletNetwork.BITCOIN,
            address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
          }
        ]
      }
    );
  });

  it('carries an empty array through so every address is cleared', async () => {
    walletRepository.update.mockResolvedValue({} as Wallet);

    await useCase.execute('wallet-id', 'user-id', { addresses: [] });

    expect(walletRepository.update).toHaveBeenCalledWith(
      'wallet-id',
      'user-id',
      { addresses: [] }
    );
  });

  it('rejects a body with no updatable field', async () => {
    await expect(useCase.execute('wallet-id', 'user-id', {})).rejects.toThrow(
      expect.objectContaining({ code: WalletErrorCode.WALLET_EMPTY_UPDATE })
    );
    expect(walletRepository.update).not.toHaveBeenCalled();
  });

  it('reports a wallet owned by another account as not found', async () => {
    walletRepository.update.mockResolvedValue(null);

    await expect(
      useCase.execute('wallet-id', 'user-id', { name: 'Ledger X' })
    ).rejects.toThrow(
      expect.objectContaining({ code: WalletErrorCode.WALLET_NOT_FOUND })
    );
  });
});
