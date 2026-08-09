import { Holding } from '../../../domain/entities/holding.entity';
import { ListHoldingsUseCase } from '../list-holdings.use-case';

describe('ListHoldingsUseCase', () => {
  const holding = {
    id: 'holding-id',
    userId: 'user-id',
    portfolioId: 'portfolio-id',
    assetId: 'asset-id',
    asset: { id: 'asset-id' }
  } as Holding;

  const holdingRepository = {
    listByUser: jest.fn()
  };

  let useCase: ListHoldingsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    holdingRepository.listByUser.mockResolvedValue([holding]);

    useCase = new ListHoldingsUseCase(holdingRepository as any);
  });

  it('should list all holdings of the user', async () => {
    const result = await useCase.execute('user-id', {});

    expect(holdingRepository.listByUser).toHaveBeenCalledWith('user-id', {
      portfolioId: undefined
    });
    expect(result).toEqual([holding]);
  });

  it('should pass through the portfolio filter', async () => {
    await useCase.execute('user-id', { portfolioId: 'portfolio-id' });

    expect(holdingRepository.listByUser).toHaveBeenCalledWith('user-id', {
      portfolioId: 'portfolio-id'
    });
  });
});
