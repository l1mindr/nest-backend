import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { DeletePortfolioUseCase } from '../delete-portfolio.use-case';

describe('DeletePortfolioUseCase', () => {
  const portfolioRepository = {
    delete: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  let useCase: DeletePortfolioUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.delete.mockResolvedValue(true);

    useCase = new DeletePortfolioUseCase(
      portfolioRepository as any,
      logger as any
    );
  });

  it('should delete an owned portfolio', async () => {
    await useCase.execute('portfolio-id', 'user-id');

    expect(portfolioRepository.delete).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id'
    );
    expect(logger.info).toHaveBeenCalled();
  });

  it('should reject a portfolio that does not belong to the user', async () => {
    portfolioRepository.delete.mockResolvedValue(false);

    await expect(
      useCase.execute('foreign-portfolio', 'user-id')
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
    });
  });

  it('should reject a nonexistent portfolio', async () => {
    portfolioRepository.delete.mockResolvedValue(false);

    await expect(
      useCase.execute('nonexistent-portfolio', 'user-id')
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
    });
  });
});
