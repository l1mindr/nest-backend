import { Asset } from '@features/assets/domain/entities/asset.entity';
import { Holding } from '../../../domain/entities/holding.entity';
import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { CreateHoldingUseCase } from '../create-holding.use-case';

describe('CreateHoldingUseCase', () => {
  const portfolio = {
    id: 'portfolio-id',
    userId: 'user-id',
    name: 'Ledger'
  } as Portfolio;
  const asset = { id: 'asset-id', symbol: 'btc', name: 'Bitcoin' } as Asset;
  const holding = {
    id: 'holding-id',
    userId: 'user-id',
    portfolioId: 'portfolio-id',
    assetId: 'asset-id',
    amount: '1.500000000000000000',
    notes: null
  } as Holding;
  const holdingRepository = {
    create: jest.fn(),
    findByPortfolioAndAsset: jest.fn()
  };
  const portfolioRepository = {
    findByIdAndUser: jest.fn()
  };
  const assetRepository = {
    findById: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  let useCase: CreateHoldingUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.findByIdAndUser.mockResolvedValue(portfolio);
    assetRepository.findById.mockResolvedValue(asset);
    holdingRepository.findByPortfolioAndAsset.mockResolvedValue(null);
    holdingRepository.create.mockResolvedValue(holding);

    useCase = new CreateHoldingUseCase(
      holdingRepository as any,
      portfolioRepository as any,
      assetRepository as any,
      logger as any,
      { record: jest.fn() } as any
    );
  });

  it('should create a holding in a portfolio owned by the user', async () => {
    const result = await useCase.execute('user-id', {
      portfolioId: 'portfolio-id',
      assetId: 'asset-id',
      amount: '1.5'
    } as any);

    expect(portfolioRepository.findByIdAndUser).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id'
    );
    expect(assetRepository.findById).toHaveBeenCalledWith('asset-id');
    expect(holdingRepository.create).toHaveBeenCalledWith({
      userId: 'user-id',
      portfolioId: 'portfolio-id',
      assetId: 'asset-id',
      amount: '1.5',
      notes: null
    });
    expect(result.asset).toBe(asset);
  });

  it('should reject a portfolio that does not belong to the user', async () => {
    portfolioRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', {
        portfolioId: 'foreign-portfolio',
        assetId: 'asset-id',
        amount: '1'
      } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
    });

    expect(assetRepository.findById).not.toHaveBeenCalled();
    expect(holdingRepository.create).not.toHaveBeenCalled();
  });

  it('should reject an unknown asset', async () => {
    assetRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', {
        portfolioId: 'portfolio-id',
        assetId: 'unknown-asset',
        amount: '1'
      } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_ASSET_NOT_FOUND
    });

    expect(holdingRepository.create).not.toHaveBeenCalled();
  });

  it('should reject a duplicate holding in the same portfolio', async () => {
    holdingRepository.findByPortfolioAndAsset.mockResolvedValue({
      id: 'existing'
    } as Holding);

    await expect(
      useCase.execute('user-id', {
        portfolioId: 'portfolio-id',
        assetId: 'asset-id',
        amount: '1'
      } as any)
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.HOLDING_ALREADY_EXISTS
    });

    expect(holdingRepository.create).not.toHaveBeenCalled();
  });
});
