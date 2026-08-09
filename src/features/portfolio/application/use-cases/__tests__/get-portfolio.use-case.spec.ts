import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { GetPortfolioUseCase } from '../get-portfolio.use-case';

describe('GetPortfolioUseCase', () => {
  const portfolio = {
    id: 'portfolio-id',
    userId: 'user-id',
    name: 'My Ledger'
  } as Portfolio;
  const portfolioRepository = {
    findByIdAndUser: jest.fn()
  };

  let useCase: GetPortfolioUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.findByIdAndUser.mockResolvedValue(portfolio);

    useCase = new GetPortfolioUseCase(portfolioRepository as any);
  });

  it('should return a portfolio owned by the user', async () => {
    const result = await useCase.execute('user-id', 'portfolio-id');

    expect(portfolioRepository.findByIdAndUser).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id'
    );
    expect(result).toBe(portfolio);
  });

  it('should reject a portfolio that does not belong to the user', async () => {
    portfolioRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', 'foreign-portfolio')
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
    });
  });
});
