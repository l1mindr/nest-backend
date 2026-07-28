import { AlertDirection } from '../../../enums/alert-direction.enum';
import { PriceAlertEvaluatorService } from '../price-alert-evaluator.service';

describe('PriceAlertEvaluatorService', () => {
  const service = new PriceAlertEvaluatorService();

  describe('hasCrossed', () => {
    it('should detect a SELL crossing from below to the target', () => {
      expect(
        service.hasCrossed(AlertDirection.SELL, '99.99999999', '100', '100')
      ).toBe(true);
    });

    it('should detect a BUY crossing from above to below the target', () => {
      expect(
        service.hasCrossed(AlertDirection.BUY, '101', '99.99999999', '100')
      ).toBe(true);
    });

    it('should not trigger merely because a price remains beyond the target', () => {
      expect(service.hasCrossed(AlertDirection.SELL, '101', '102', '100')).toBe(
        false
      );
      expect(service.hasCrossed(AlertDirection.BUY, '99', '98', '100')).toBe(
        false
      );
    });

    it('should establish a baseline when no previous price exists', () => {
      expect(service.hasCrossed(AlertDirection.SELL, null, '101', '100')).toBe(
        false
      );
    });

    it('should compare decimal and scientific notation without float rounding', () => {
      expect(
        service.hasCrossed(
          AlertDirection.SELL,
          '0.000000009',
          '1e-8',
          '0.000000010'
        )
      ).toBe(true);
    });
  });

  describe('isCooldownExpired', () => {
    const now = new Date('2026-07-28T08:00:00.000Z');

    it('should allow the first notification', () => {
      expect(service.isCooldownExpired(null, 60, now)).toBe(true);
    });

    it('should enforce the configured cooldown', () => {
      expect(
        service.isCooldownExpired(new Date('2026-07-28T07:30:01.000Z'), 30, now)
      ).toBe(false);
    });

    it('should allow a notification at the cooldown boundary', () => {
      expect(
        service.isCooldownExpired(new Date('2026-07-28T07:00:00.000Z'), 60, now)
      ).toBe(true);
    });
  });
});
