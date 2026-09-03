import { Wallet } from '../../../domain/entities/wallet.entity';
import { CreateWalletUseCase } from '../create-wallet.use-case';

describe('CreateWalletUseCase', () => {
  const walletRepository = {
    create: jest.fn(),
    findByIdAndUser: jest.fn(),
    findByUserId: jest.fn()
  };

  let useCase: CreateWalletUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateWalletUseCase(walletRepository as any);
  });

  it('creates a wallet scoped to the caller with a null address when none is given', async () => {
    const created = {
      id: 'wallet-id',
      userId: 'user-id',
      name: 'Ledger',
      address: null
    } as Wallet;
    walletRepository.create.mockResolvedValue(created);

    const result = await useCase.execute('user-id', { name: 'Ledger' });

    expect(walletRepository.create).toHaveBeenCalledWith({
      userId: 'user-id',
      name: 'Ledger',
      address: null
    });
    expect(result).toBe(created);
  });

  it('passes the address through when provided', async () => {
    walletRepository.create.mockResolvedValue({} as Wallet);

    await useCase.execute('user-id', { name: 'MetaMask', address: '0xabc' });

    expect(walletRepository.create).toHaveBeenCalledWith({
      userId: 'user-id',
      name: 'MetaMask',
      address: '0xabc'
    });
  });
});
