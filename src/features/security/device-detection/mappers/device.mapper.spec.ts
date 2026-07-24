import { DeviceMapper } from './device.mapper';

describe('DeviceMapper', () => {
  let mapper: DeviceMapper;

  beforeEach(() => {
    mapper = new DeviceMapper();
  });

  it('should map DeviceContext to ISessionDevice', () => {
    const result = mapper.toSessionUserAgent({
      browserName: 'Chrome',
      browserVersion: '120.0.0.0',
      osName: 'Windows',
      deviceType: 'desktop',
      fingerprintRisk: 'low'
    });

    expect(result).toEqual({
      browserName: 'Chrome',
      browserVersion: '120.0.0.0',
      osName: 'Windows',
      deviceType: 'desktop'
    });
  });

  it('should strip fingerprintRisk from output', () => {
    const result = mapper.toSessionUserAgent({
      browserName: 'Safari',
      browserVersion: '17.0',
      osName: 'iOS',
      deviceType: 'mobile',
      fingerprintRisk: 'high'
    });

    expect(result).not.toHaveProperty('fingerprintRisk');
  });

  it('should handle high risk input', () => {
    const result = mapper.toSessionUserAgent({
      browserName: 'unknown',
      browserVersion: 'unknown',
      osName: 'unknown',
      deviceType: 'desktop',
      fingerprintRisk: 'high'
    });

    expect(result).toEqual({
      browserName: 'unknown',
      browserVersion: 'unknown',
      osName: 'unknown',
      deviceType: 'desktop'
    });
  });

  it('should return exactly four fields', () => {
    const result = mapper.toSessionUserAgent({
      browserName: 'Firefox',
      browserVersion: '121.0',
      osName: 'Linux',
      deviceType: 'desktop',
      fingerprintRisk: 'low'
    });

    expect(Object.keys(result)).toEqual([
      'browserName',
      'browserVersion',
      'osName',
      'deviceType'
    ]);
  });
});
