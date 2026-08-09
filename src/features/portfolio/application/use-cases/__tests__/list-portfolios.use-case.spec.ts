import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { ListPortfoliosUseCase } from '../list-portfolios.use-case';

describe('ListPortfoliosUseCase', () => {
  const portfolio = {
    id: 'portfolio-id',
    userId: 'user-id',
    name: 'My Ledger'
  } as Portfolio;
  const portfolioRepository = {
    findByUserId: jest.fn()
  };

  let useCase: ListPortfoliosUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.findByUserId.mockResolvedValue([portfolio]);

    useCase = new ListPortfoliosUseCase(portfolioRepository as any);
  });

  it('should return every portfolio of the user', async () => {
    const result = await useCase.execute('user-id');

    expect(portfolioRepository.findByUserId).toHaveBeenCalledWith('user-id');
    expect(result).toEqual([portfolio]);
  });

  it('should return an empty list when the user owns none', async () => {
    portfolioRepository.findByUserId.mockResolvedValue([]);

    const result = await useCase.execute('user-id');

    expect(result).toEqual([]);
  });
});
