import { Asset } from '@features/assets/domain/entities/asset.entity';
import { Portfolio } from '../../../domain/entities/portfolio.entity';
import { PortfolioOpeningBalance } from '../../../domain/entities/portfolio-opening-balance.entity';
import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { SetPortfolioOpeningBalanceUseCase } from '../set-portfolio-opening-balance.use-case';

describe('SetPortfolioOpeningBalanceUseCase', () => {
  const portfolio = {
    id: 'portfolio-id',
    userId: 'user-id',
    name: 'Ledger'
  } as Portfolio;
  const asset = { id: 'asset-id', symbol: 'btc', name: 'Bitcoin' } as Asset;
  const openingBalance = {
    id: 'opening-balance-id',
    userId: 'user-id',
    portfolioId: 'portfolio-id',
    assetId: 'asset-id',
    openingQuantity: '1.500000000000000000',
    openingCost: '90000.00000000000000000000000000'
  } as PortfolioOpeningBalance;
  const openingBalanceRepository = {
    upsert: jest.fn()
  };
  const portfolioRepository = {
    findByIdAndUser: jest.fn()
  };
  const assetRepository = {
    findById: jest.fn()
  };
  const checkpointRepository = {
    deleteByPortfolioAndAsset: jest.fn(),
    withAssetLock: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  let useCase: SetPortfolioOpeningBalanceUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    portfolioRepository.findByIdAndUser.mockResolvedValue(portfolio);
    assetRepository.findById.mockResolvedValue(asset);
    openingBalanceRepository.upsert.mockResolvedValue(openingBalance);
    checkpointRepository.withAssetLock.mockImplementation(
      async (
        _portfolioId: string,
        _assetId: string,
        work: (manager: unknown) => Promise<unknown>
      ) => work({})
    );

    useCase = new SetPortfolioOpeningBalanceUseCase(
      openingBalanceRepository as any,
      portfolioRepository as any,
      assetRepository as any,
      checkpointRepository as any,
      logger as any
    );
  });

  it('should persist the exact opening state for an owned portfolio asset', async () => {
    const result = await useCase.execute(
      'user-id',
      'portfolio-id',
      'asset-id',
      {
        openingQuantity: '1.5',
        openingCost: '90000.12345678901234567890123456'
      }
    );

    expect(portfolioRepository.findByIdAndUser).toHaveBeenCalledWith(
      'portfolio-id',
      'user-id'
    );
    expect(assetRepository.findById).toHaveBeenCalledWith('asset-id');
    expect(openingBalanceRepository.upsert).toHaveBeenCalledWith(
      {
        userId: 'user-id',
        portfolioId: 'portfolio-id',
        assetId: 'asset-id',
        openingQuantity: '1.5',
        openingCost: '90000.12345678901234567890123456'
      },
      expect.any(Object)
    );
    expect(result.portfolio).toBe(portfolio);
    expect(result.asset).toBe(asset);
  });

  it('should establish portfolio ownership before resolving the asset', async () => {
    portfolioRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', 'foreign-portfolio', 'asset-id', {
        openingQuantity: '1',
        openingCost: '100'
      })
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_NOT_FOUND
    });

    expect(assetRepository.findById).not.toHaveBeenCalled();
    expect(openingBalanceRepository.upsert).not.toHaveBeenCalled();
  });

  it('should reject an unknown asset without writing', async () => {
    assetRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('user-id', 'portfolio-id', 'unknown-asset', {
        openingQuantity: '1',
        openingCost: '100'
      })
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.PORTFOLIO_ASSET_NOT_FOUND
    });

    expect(openingBalanceRepository.upsert).not.toHaveBeenCalled();
  });
});
