import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { PortfolioSourceType } from '../../../domain/enums/portfolio-source-type.enum';
import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { UpdatePortfolioUseCase } from '../update-portfolio.use-case';

describe('UpdatePortfolioUseCase', () => {
  const portfolio = {
    id: 'portfolio-id',
    userId: 'user-id',
    name: 'My Ledger',
    sourceType: PortfolioSourceType.WALLET,
    walletAddress: '0x1234...'
  } as Portfolio;
  const portfolioRepository = {
    findByIdAndUser: jest.fn(),
    update: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  let useCase: UpdatePortfolioUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.findByIdAndUser.mockResolvedValue(portfolio);
    portfolioRepository.update.mockResolvedValue({
      ...portfolio,
      name: 'Updated Ledger'
    });

    useCase = new UpdatePortfolioUseCase(
      portfolioRepository as any,
      logger as any
    );
  });

  it('should update the name of an owned portfolio', async () => {
    const result = await useCase.execute('portfolio-id', 'user-id', {
      name: 'Updated Ledger'
    });

    expect(portfolioRepository.findByIdAndUser).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id'
    );
    expect(portfolioRepository.update).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id',
      { name: 'Updated Ledger' }
    );
    expect(result.name).toBe('Updated Ledger');
  });

  it('should update the sourceType', async () => {
    portfolioRepository.update.mockResolvedValue({
      ...portfolio,
      sourceType: PortfolioSourceType.EXCHANGE
    });

    const result = await useCase.execute('portfolio-id', 'user-id', {
      sourceType: PortfolioSourceType.EXCHANGE
    });

    expect(portfolioRepository.update).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id',
      { sourceType: PortfolioSourceType.EXCHANGE }
    );
    expect(result.sourceType).toBe(PortfolioSourceType.EXCHANGE);
  });

  it('should clear walletAddress when null is passed', async () => {
    portfolioRepository.update.mockResolvedValue({
      ...portfolio,
      walletAddress: null
    });

    const result = await useCase.execute('portfolio-id', 'user-id', {
      walletAddress: null
    });

    expect(portfolioRepository.update).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id',
      { walletAddress: null }
    );
    expect(result.walletAddress).toBeNull();
  });

  it('should update multiple fields at once', async () => {
    portfolioRepository.update.mockResolvedValue({
      ...portfolio,
      name: 'Updated Exchange',
      sourceType: PortfolioSourceType.EXCHANGE,
      walletAddress: null
    });

    const result = await useCase.execute('portfolio-id', 'user-id', {
      name: 'Updated Exchange',
      sourceType: PortfolioSourceType.EXCHANGE,
      walletAddress: null
    });

    expect(portfolioRepository.update).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id',
      {
        name: 'Updated Exchange',
        sourceType: PortfolioSourceType.EXCHANGE,
        walletAddress: null
      }
    );
    expect(result.name).toBe('Updated Exchange');
    expect(result.sourceType).toBe(PortfolioSourceType.EXCHANGE);
  });

  it('should reject an empty update', async () => {
    await expect(
      useCase.execute('portfolio-id', 'user-id', {})
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_EMPTY_UPDATE
    });

    expect(portfolioRepository.findByIdAndUser).not.toHaveBeenCalled();
    expect(portfolioRepository.update).not.toHaveBeenCalled();
  });

  it('should reject a portfolio that does not belong to the user', async () => {
    portfolioRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('foreign-portfolio', 'user-id', { name: 'Updated' })
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
    });

    expect(portfolioRepository.update).not.toHaveBeenCalled();
  });

  it('should reject a portfolio that disappeared during the update', async () => {
    portfolioRepository.update.mockResolvedValue(null);

    await expect(
      useCase.execute('portfolio-id', 'user-id', { name: 'Updated' })
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
    });
  });
});
