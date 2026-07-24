import { DeviceContext } from '../context/device-context.interface';
import { FingerprintService } from './fingerprint.service';

describe('FingerprintService', () => {
  let service: FingerprintService;

  beforeEach(() => {
    service = new FingerprintService();
  });

  const device = (overrides: Partial<DeviceContext> = {}): DeviceContext => ({
    browserName: 'Chrome',
    browserVersion: '120.0.0.0',
    osName: 'Windows',
    deviceType: 'desktop',
    ...overrides
  });

  describe('high risk', () => {
    it('should return high when both browser and OS are unknown', () => {
      const result = service.analyze(
        device({ browserName: 'unknown', osName: 'unknown' })
      );
      expect(result.fingerprintRisk).toBe('high');
    });

    it('should return high for empty UA on any device type', () => {
      const result = service.analyze(
        device({
          browserName: 'unknown',
          osName: 'unknown',
          deviceType: 'mobile'
        })
      );
      expect(result.fingerprintRisk).toBe('high');
    });
  });

  describe('medium risk', () => {
    it('should return medium when browser is unknown but OS is known', () => {
      const result = service.analyze(
        device({ browserName: 'unknown', osName: 'Windows' })
      );
      expect(result.fingerprintRisk).toBe('medium');
    });

    it('should return medium when OS is unknown but browser is known', () => {
      const result = service.analyze(
        device({ browserName: 'Chrome', osName: 'unknown' })
      );
      expect(result.fingerprintRisk).toBe('medium');
    });

    it('should return medium when browser version is unknown', () => {
      const result = service.analyze(device({ browserVersion: 'unknown' }));
      expect(result.fingerprintRisk).toBe('medium');
    });
  });

  describe('low risk', () => {
    it('should return low when all fields are populated', () => {
      const result = service.analyze(device());
      expect(result.fingerprintRisk).toBe('low');
    });

    it('should return low for mobile with complete UA', () => {
      const result = service.analyze(
        device({
          browserName: 'Chrome',
          browserVersion: '120.0.0.0',
          osName: 'Android',
          deviceType: 'mobile'
        })
      );
      expect(result.fingerprintRisk).toBe('low');
    });

    it('should return low for tablet with complete UA', () => {
      const result = service.analyze(
        device({
          browserName: 'Safari',
          browserVersion: '17.0',
          osName: 'iOS',
          deviceType: 'tablet'
        })
      );
      expect(result.fingerprintRisk).toBe('low');
    });

    it('should return low for Firefox on macOS', () => {
      const result = service.analyze(
        device({
          browserName: 'Firefox',
          browserVersion: '121.0',
          osName: 'Mac OS'
        })
      );
      expect(result.fingerprintRisk).toBe('low');
    });
  });

  describe('return shape', () => {
    it('should return only fingerprintRisk', () => {
      const result = service.analyze(device());
      expect(Object.keys(result)).toEqual(['fingerprintRisk']);
    });

    it('should not return isTrusted', () => {
      const result = service.analyze(device());
      expect(result).not.toHaveProperty('isTrusted');
    });
  });
});
