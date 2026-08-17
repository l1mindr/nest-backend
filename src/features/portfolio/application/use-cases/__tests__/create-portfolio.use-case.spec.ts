import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { CreatePortfolioUseCase } from '../create-portfolio.use-case';

describe('CreatePortfolioUseCase', () => {
  const portfolio = {
    id: 'portfolio-id',
    userId: 'user-id',
    name: 'My Ledger',
    sourceType: 'WALLET',
    walletAddress: null
  } as Portfolio;
  const portfolioRepository = {
    create: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  let useCase: CreatePortfolioUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.create.mockResolvedValue(portfolio);

    useCase = new CreatePortfolioUseCase(
      portfolioRepository as any,
      logger as any,
      { record: jest.fn() } as any
    );
  });

  it('should create a portfolio for the user', async () => {
    const result = await useCase.execute('user-id', {
      name: '  My Ledger  ',
      sourceType: 'WALLET'
    } as any);

    expect(portfolioRepository.create).toHaveBeenCalledWith({
      userId: 'user-id',
      name: '  My Ledger  ',
      sourceType: 'WALLET',
      walletAddress: null
    });
    expect(result).toBe(portfolio);
  });

  it('should persist the optional wallet address', async () => {
    await useCase.execute('user-id', {
      name: 'Ledger',
      sourceType: 'WALLET',
      walletAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
    } as any);

    expect(portfolioRepository.create).toHaveBeenCalledWith({
      userId: 'user-id',
      name: 'Ledger',
      sourceType: 'WALLET',
      walletAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
    });
  });

  it('should log the created portfolio', async () => {
    await useCase.execute('user-id', {
      name: 'My Ledger',
      sourceType: 'WALLET'
    } as any);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'portfolio.created',
        portfolioId: 'portfolio-id',
        userId: 'user-id'
      }),
      expect.any(String)
    );
  });
});
