import { Wallet } from '../../../domain/entities/wallet.entity';
import { ListWalletsUseCase } from '../list-wallets.use-case';

describe('ListWalletsUseCase', () => {
  const walletRepository = {
    create: jest.fn(),
    findByIdAndUser: jest.fn(),
    findByUserId: jest.fn()
  };

  let useCase: ListWalletsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ListWalletsUseCase(walletRepository as any);
  });

  it("returns only the caller's wallets", async () => {
    const wallets = [{ id: 'w1' }, { id: 'w2' }] as Wallet[];
    walletRepository.findByUserId.mockResolvedValue(wallets);

    const result = await useCase.execute('user-id');

    expect(walletRepository.findByUserId).toHaveBeenCalledWith('user-id');
    expect(result).toBe(wallets);
  });
});
