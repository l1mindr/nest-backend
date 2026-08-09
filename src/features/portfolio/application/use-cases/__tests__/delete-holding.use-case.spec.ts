import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { DeleteHoldingUseCase } from '../delete-holding.use-case';

describe('DeleteHoldingUseCase', () => {
  const holdingRepository = {
    delete: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  let useCase: DeleteHoldingUseCase;

  beforeEach(() => {
    jest.clearAllMocks();

    useCase = new DeleteHoldingUseCase(holdingRepository as any, logger as any);
  });

  it('should delete a holding owned by the user', async () => {
    holdingRepository.delete.mockResolvedValue(true);

    await expect(
      useCase.execute('holding-id', 'user-id')
    ).resolves.toBeUndefined();

    expect(holdingRepository.delete).toHaveBeenCalledWith(
      'holding-id',
      'user-id'
    );
    expect(logger.info).toHaveBeenCalled();
  });

  it('should reject a holding that does not belong to the user', async () => {
    holdingRepository.delete.mockResolvedValue(false);

    await expect(
      useCase.execute('foreign-holding', 'user-id')
    ).rejects.toMatchObject({
      code: PortfolioErrorCode.HOLDING_NOT_FOUND
    });
  });
});
