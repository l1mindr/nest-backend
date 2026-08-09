import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { PortfolioTransaction } from '../../../domain/entities/portfolio-transaction.entity';
import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { PortfolioTransactionType } from '../../../domain/enums/portfolio-transaction-type.enum';
import { GetPortfolioTransactionUseCase } from '../get-portfolio-transaction.use-case';

describe('GetPortfolioTransactionUseCase', () => {
  const portfolio = {
    id: 'portfolio-id',
    userId: 'user-id',
    name: 'Ledger'
  } as Portfolio;
  const transaction = {
    id: 'transaction-id',
    userId: 'user-id',
    portfolioId: 'portfolio-id',
    assetId: 'asset-id',
    type: PortfolioTransactionType.BUY,
    amount: '1.5',
    price: '60000.5',
    fee: null,
    notes: null
  } as PortfolioTransaction;
  const transactionRepository = {
    findByIdAndPortfolioAndUser: jest.fn()
  };
  const portfolioRepository = {
    findByIdAndUser: jest.fn()
  };

  let useCase: GetPortfolioTransactionUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.findByIdAndUser.mockResolvedValue(portfolio);
    transactionRepository.findByIdAndPortfolioAndUser.mockResolvedValue(
      transaction
    );

    useCase = new GetPortfolioTransactionUseCase(
      transactionRepository as any,
      portfolioRepository as any
    );
  });

  it('should return a transaction owned by the user', async () => {
    const result = await useCase.execute(
      'user-id',
      'portfolio-id',
      'transaction-id'
    );

    expect(portfolioRepository.findByIdAndUser).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id'
    );
    expect(
      transactionRepository.findByIdAndPortfolioAndUser
    ).toHaveBeenCalledWith('transaction-id', 'portfolio-id', 'user-id');
    expect(result).toBe(transaction);
  });

  it('should reject a portfolio that does not belong to the user', async () => {
    portfolioRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', 'foreign-portfolio', 'transaction-id')
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
    });

    expect(
      transactionRepository.findByIdAndPortfolioAndUser
    ).not.toHaveBeenCalled();
  });

  it('should reject an unknown transaction', async () => {
    transactionRepository.findByIdAndPortfolioAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', 'portfolio-id', 'unknown-transaction')
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.TRANSACTION_NOT_FOUND
    });
  });
});
