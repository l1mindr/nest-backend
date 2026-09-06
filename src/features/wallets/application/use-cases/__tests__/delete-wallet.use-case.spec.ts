import { Wallet } from '../../../domain/entities/wallet.entity';
import { WalletErrorCode } from '../../../domain/errors/wallet-error-code.enum';
import { DeleteWalletUseCase } from '../delete-wallet.use-case';

describe('DeleteWalletUseCase', () => {
  const walletRepository = {
    create: jest.fn(),
    findByIdAndUser: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countTransactionReferences: jest.fn()
  };

  let useCase: DeleteWalletUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new DeleteWalletUseCase(walletRepository as any);
  });

  it('deletes a wallet no transaction references', async () => {
    walletRepository.findByIdAndUser.mockResolvedValue({
      id: 'wallet-id'
    } as Wallet);
    walletRepository.countTransactionReferences.mockResolvedValue(0);
    walletRepository.delete.mockResolvedValue(true);

    await useCase.execute('wallet-id', 'user-id');

    expect(walletRepository.delete).toHaveBeenCalledWith(
      'wallet-id',
      'user-id'
    );
  });

  it('refuses to delete a wallet that transactions still reference', async () => {
    walletRepository.findByIdAndUser.mockResolvedValue({
      id: 'wallet-id'
    } as Wallet);
    walletRepository.countTransactionReferences.mockResolvedValue(3);

    await expect(useCase.execute('wallet-id', 'user-id')).rejects.toThrow(
      expect.objectContaining({
        code: WalletErrorCode.WALLET_IN_USE,
        metadata: { walletId: 'wallet-id', transactionCount: 3 }
      })
    );
    expect(walletRepository.delete).not.toHaveBeenCalled();
  });

  it('reports a wallet owned by another account as not found without counting references', async () => {
    walletRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(useCase.execute('wallet-id', 'user-id')).rejects.toThrow(
      expect.objectContaining({ code: WalletErrorCode.WALLET_NOT_FOUND })
    );
    expect(walletRepository.countTransactionReferences).not.toHaveBeenCalled();
    expect(walletRepository.delete).not.toHaveBeenCalled();
  });
});
