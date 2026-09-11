import { PortfolioErrorCode } from '../../../domain/errors/portfolio-error-code.enum';
import { PortfolioTransactionType } from '../../../domain/enums/portfolio-transaction-type.enum';
import { TransactionPriceCurrency } from '../../../domain/enums/transaction-price-currency.enum';
import { TransactionPriceNormalizerService } from '../transaction-price-normalizer.service';

const RATE = '234619';

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    priceToman: RATE,
    priceChangePercentage24h: '3.3000',
    updatedAt: new Date('2026-09-10T09:00:00.000Z'),
    provider: 'nobitex',
    fetchedAt: new Date('2026-09-10T09:00:00.000Z'),
    isStale: false,
    ...overrides
  };
}

describe('TransactionPriceNormalizerService', () => {
  const getUsdtToman = { execute: jest.fn() };
  const logger = { setContext: jest.fn(), warn: jest.fn(), error: jest.fn() };

  let service: TransactionPriceNormalizerService;

  beforeEach(() => {
    jest.clearAllMocks();
    getUsdtToman.execute.mockResolvedValue(snapshot());
    service = new TransactionPriceNormalizerService(
      getUsdtToman as never,
      logger as never
    );
  });

  describe('USD entries', () => {
    it('passes a USD price and fee through unchanged', async () => {
      await expect(
        service.normalize({
          type: PortfolioTransactionType.BUY,
          price: '1',
          fee: '2',
          priceCurrency: TransactionPriceCurrency.USD
        })
      ).resolves.toEqual({
        price: '1',
        fee: '2',
        priceCurrency: TransactionPriceCurrency.USD,
        enteredPrice: null,
        enteredFee: null,
        usdtTomanRate: null
      });
    });

    // Every client that predates this field must keep working untouched.
    it('defaults to USD when no currency is supplied', async () => {
      const result = await service.normalize({
        type: PortfolioTransactionType.BUY,
        price: '60000.50',
        fee: '0.75'
      });

      expect(result.price).toBe('60000.50');
      expect(result.priceCurrency).toBe(TransactionPriceCurrency.USD);
    });

    it('never asks for a rate for a USD entry', async () => {
      await service.normalize({
        type: PortfolioTransactionType.BUY,
        price: '1',
        fee: null
      });

      expect(getUsdtToman.execute).not.toHaveBeenCalled();
    });

    it('allows USD on a transfer, which is what a transfer already means', async () => {
      await expect(
        service.normalize({
          type: PortfolioTransactionType.TRANSFER_IN,
          price: null,
          fee: null,
          priceCurrency: TransactionPriceCurrency.USD
        })
      ).resolves.toMatchObject({ price: null, fee: null });
    });
  });

  describe('Toman entries', () => {
    it('converts price and fee at the live rate and keeps the originals', async () => {
      await expect(
        service.normalize({
          type: PortfolioTransactionType.BUY,
          price: '234000',
          fee: '50000',
          priceCurrency: TransactionPriceCurrency.TOMAN
        })
      ).resolves.toEqual({
        price: '0.99736168',
        fee: '0.21311147',
        priceCurrency: TransactionPriceCurrency.TOMAN,
        enteredPrice: '234000',
        enteredFee: '50000',
        usdtTomanRate: RATE
      });
    });

    it('reads the rate from the market use case, not the request', async () => {
      await service.normalize({
        type: PortfolioTransactionType.BUY,
        price: '234000',
        fee: null,
        priceCurrency: TransactionPriceCurrency.TOMAN
      });

      expect(getUsdtToman.execute).toHaveBeenCalledTimes(1);
    });

    it('accepts a Toman SELL as well as a BUY', async () => {
      await expect(
        service.normalize({
          type: PortfolioTransactionType.SELL,
          price: '234000',
          fee: null,
          priceCurrency: TransactionPriceCurrency.TOMAN
        })
      ).resolves.toMatchObject({ price: '0.99736168' });
    });

    it('converts at a stale rate but says so', async () => {
      getUsdtToman.execute.mockResolvedValue(snapshot({ isStale: true }));

      const result = await service.normalize({
        type: PortfolioTransactionType.BUY,
        price: '234000',
        fee: null,
        priceCurrency: TransactionPriceCurrency.TOMAN
      });

      expect(result.usdtTomanRate).toBe(RATE);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'nobitex', rate: RATE }),
        expect.stringContaining('stale')
      );
    });
  });

  describe('rejections', () => {
    // A currency on a type with no price would record a denomination for a
    // value that does not exist.
    it.each([
      PortfolioTransactionType.TRANSFER_IN,
      PortfolioTransactionType.TRANSFER_OUT
    ])('rejects a Toman %s', async (type) => {
      await expect(
        service.normalize({
          type,
          price: null,
          fee: null,
          priceCurrency: TransactionPriceCurrency.TOMAN
        })
      ).rejects.toThrow(
        expect.objectContaining({
          code: PortfolioErrorCode.TRANSACTION_PRICE_CURRENCY_NOT_APPLICABLE
        })
      );
    });

    // Falling back to "treat it as USD" would record a price ~234,000x too
    // low, so failing the request is the only safe outcome.
    it('fails the transaction when no rate can be obtained', async () => {
      getUsdtToman.execute.mockRejectedValue(new Error('providers exhausted'));

      await expect(
        service.normalize({
          type: PortfolioTransactionType.BUY,
          price: '234000',
          fee: '50000',
          priceCurrency: TransactionPriceCurrency.TOMAN
        })
      ).rejects.toThrow(
        expect.objectContaining({
          code: PortfolioErrorCode.TRANSACTION_PRICE_RATE_UNAVAILABLE
        })
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('normalizeUpdate', () => {
    const usdExisting = {
      price: '60000',
      fee: '0.75',
      priceCurrency: TransactionPriceCurrency.USD,
      enteredPrice: null,
      enteredFee: null
    };

    const tomanExisting = {
      price: '0.99736168',
      fee: '0.21311147',
      priceCurrency: TransactionPriceCurrency.TOMAN,
      enteredPrice: '234000',
      enteredFee: '50000'
    };

    it('keeps a USD transaction in USD when only the price is patched', async () => {
      await expect(
        service.normalizeUpdate({
          type: PortfolioTransactionType.BUY,
          price: '61000',
          existing: usdExisting
        })
      ).resolves.toEqual({
        price: '61000',
        fee: '0.75',
        priceCurrency: TransactionPriceCurrency.USD,
        enteredPrice: null,
        enteredFee: null,
        usdtTomanRate: null
      });
    });

    it('re-converts a Toman transaction when its price is patched', async () => {
      const result = await service.normalizeUpdate({
        type: PortfolioTransactionType.BUY,
        price: '235000',
        existing: tomanExisting
      });

      expect(result).toMatchObject({
        priceCurrency: TransactionPriceCurrency.TOMAN,
        enteredPrice: '235000',
        // Untouched by the patch, so it carries over as entered.
        enteredFee: '50000',
        usdtTomanRate: RATE
      });
    });

    it('restates a USD transaction in Toman when only the currency changes', async () => {
      const result = await service.normalizeUpdate({
        type: PortfolioTransactionType.BUY,
        priceCurrency: TransactionPriceCurrency.TOMAN,
        existing: usdExisting
      });

      // 60000 USD × 234619 Toman/USD, then back again — the same trade.
      expect(result.enteredPrice).toBe('14077140000');
      expect(result.price).toBe('60000');
    });

    it('drops the conversion when a Toman transaction moves back to USD', async () => {
      const result = await service.normalizeUpdate({
        type: PortfolioTransactionType.BUY,
        priceCurrency: TransactionPriceCurrency.USD,
        existing: tomanExisting
      });

      expect(result).toEqual({
        price: '0.99736168',
        fee: '0.21311147',
        priceCurrency: TransactionPriceCurrency.USD,
        enteredPrice: null,
        enteredFee: null,
        usdtTomanRate: null
      });
    });
  });
});
