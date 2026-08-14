import { Holding } from '../../../domain/entities/holding.entity';
import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { UpdateHoldingUseCase } from '../update-holding.use-case';

describe('UpdateHoldingUseCase', () => {
  const holding = {
    id: 'holding-id',
    userId: 'user-id',
    portfolioId: 'portfolio-id',
    assetId: 'asset-id',
    amount: '1.500000000000000000',
    notes: 'old note'
  } as Holding;
  const holdingRepository = {
    findByIdAndUser: jest.fn(),
    update: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  let useCase: UpdateHoldingUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    holdingRepository.findByIdAndUser.mockResolvedValue(holding);
    holdingRepository.update.mockResolvedValue({
      ...holding,
      amount: '2.500000000000000000'
    });

    useCase = new UpdateHoldingUseCase(holdingRepository as any, logger as any);
  });

  it('should update the amount of an owned holding', async () => {
    const result = await useCase.execute('holding-id', 'user-id', {
      amount: '2.5'
    });

    expect(holdingRepository.findByIdAndUser).toHaveBeenCalledWith(
      'holding-id',
      'user-id'
    );
    expect(holdingRepository.update).toHaveBeenCalledWith(
      'holding-id',
      'user-id',
      { amount: '2.5' }
    );
    expect(result.amount).toBe('2.500000000000000000');
  });

  it('should clear notes when null is passed', async () => {
    holdingRepository.update.mockResolvedValue({ ...holding, notes: null });

    const result = await useCase.execute('holding-id', 'user-id', {
      notes: null
    });

    expect(holdingRepository.update).toHaveBeenCalledWith(
      'holding-id',
      'user-id',
      { notes: null }
    );
    expect(result.notes).toBeNull();
  });

  it('should reject an empty update', async () => {
    await expect(
      useCase.execute('holding-id', 'user-id', {})
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.HOLDING_EMPTY_UPDATE
    });

    expect(holdingRepository.findByIdAndUser).not.toHaveBeenCalled();
    expect(holdingRepository.update).not.toHaveBeenCalled();
  });

  it('should reject a holding that does not belong to the user', async () => {
    holdingRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('foreign-holding', 'user-id', { amount: '1' })
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.HOLDING_NOT_FOUND
    });

    expect(holdingRepository.update).not.toHaveBeenCalled();
  });

  it('should reject a holding that disappeared during the update', async () => {
    holdingRepository.update.mockResolvedValue(null);

    await expect(
      useCase.execute('holding-id', 'user-id', { amount: '1' })
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.HOLDING_NOT_FOUND
    });
  });
});
