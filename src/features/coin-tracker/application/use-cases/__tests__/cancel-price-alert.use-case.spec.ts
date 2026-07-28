import { PriceAlert } from '../../../entities/price-alert.entity';
import { AlertStatus } from '../../../enums/alert-status.enum';
import { CoinTrackerErrorCode } from '../../../errors/coin-tracker-error-code.enum';
import { CancelPriceAlertUseCase } from '../cancel-price-alert.use-case';

describe('CancelPriceAlertUseCase', () => {
  const priceAlertRepository = {
    findByIdAndUser: jest.fn(),
    updateOwned: jest.fn()
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn()
  };

  let useCase: CancelPriceAlertUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    priceAlertRepository.findByIdAndUser.mockResolvedValue({
      id: 'alert-id',
      userId: 'user-id',
      coinId: 'bitcoin',
      status: AlertStatus.ACTIVE
    } as PriceAlert);

    useCase = new CancelPriceAlertUseCase(
      priceAlertRepository as any,
      logger as any
    );
  });

  it('should soft cancel an owned alert', async () => {
    await useCase.execute('alert-id', 'user-id');

    expect(priceAlertRepository.updateOwned).toHaveBeenCalledWith(
      'alert-id',
      'user-id',
      { status: AlertStatus.CANCELLED }
    );
  });

  it('should not reveal an alert owned by another user', async () => {
    priceAlertRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(
      useCase.execute('alert-id', 'other-user')
    ).rejects.toMatchObject({
      code: CoinTrackerErrorCode.PRICE_ALERT_NOT_FOUND
    });
  });

  it.each([
    [AlertStatus.CANCELLED, CoinTrackerErrorCode.PRICE_ALERT_CANCELLED],
    [AlertStatus.EXPIRED, CoinTrackerErrorCode.PRICE_ALERT_EXPIRED]
  ])('should reject terminal status %s', async (status, code) => {
    priceAlertRepository.findByIdAndUser.mockResolvedValue({
      id: 'alert-id',
      status
    } as PriceAlert);

    await expect(useCase.execute('alert-id', 'user-id')).rejects.toMatchObject({
      code
    });
  });
});
