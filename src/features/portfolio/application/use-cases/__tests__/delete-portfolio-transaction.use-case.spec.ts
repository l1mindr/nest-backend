import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { DeletePortfolioTransactionUseCase } from '../delete-portfolio-transaction.use-case';

describe('DeletePortfolioTransactionUseCase', () => {
  const portfolio = {
    id: 'portfolio-id',
    userId: 'user-id',
    name: 'Ledger'
  } as Portfolio;
  const transactionRepository = {
    deleteByIdAndPortfolioAndUser: jest.fn(),
    findByIdAndPortfolioAndUser: jest.fn()
  };
  const portfolioRepository = {
    findByIdAndUser: jest.fn()
  };
  const checkpointRepository = {
    deleteByPortfolioAndAsset: jest.fn(),
    withAssetLock: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  let useCase: DeletePortfolioTransactionUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.findByIdAndUser.mockResolvedValue(portfolio);
    transactionRepository.deleteByIdAndPortfolioAndUser.mockResolvedValue(true);
    transactionRepository.findByIdAndPortfolioAndUser.mockResolvedValue({
      id: 'transaction-id',
      assetId: 'asset-id'
    });
    checkpointRepository.withAssetLock.mockImplementation(
      async (
        _portfolioId: string,
        _assetId: string,
        work: (manager: unknown) => Promise<unknown>
      ) => work({})
    );

    useCase = new DeletePortfolioTransactionUseCase(
      transactionRepository as any,
      portfolioRepository as any,
      checkpointRepository as any,
      logger as any,
      { record: jest.fn() } as any,
      { publishToUser: jest.fn() } as any
    );
  });

  it('should delete a transaction owned by the user and log it', async () => {
    await useCase.execute('user-id', 'portfolio-id', 'transaction-id');

    expect(portfolioRepository.findByIdAndUser).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id'
    );
    expect(
      transactionRepository.deleteByIdAndPortfolioAndUser
    ).toHaveBeenCalledWith(
      'transaction-id',
      'portfolio-id',
      'user-id',
      expect.any(Object)
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: LogEvent.PORTFOLIO_TRANSACTION_DELETED,
        transactionId: 'transaction-id'
      }),
      'Portfolio transaction deleted'
    );
  });

  it('should reject a portfolio that does not belong to the user', async () => {
    portfolioRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', 'foreign-portfolio', 'transaction-id')
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
    });

    expect(
      transactionRepository.deleteByIdAndPortfolioAndUser
    ).not.toHaveBeenCalled();
  });

  it('should reject an unknown transaction', async () => {
    transactionRepository.deleteByIdAndPortfolioAndUser.mockResolvedValue(
      false
    );

    await expect(
      useCase.execute('user-id', 'portfolio-id', 'unknown-transaction')
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.TRANSACTION_NOT_FOUND
    });

    expect(logger.info).not.toHaveBeenCalled();
  });
});
