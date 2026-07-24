import { DeviceDetectorService } from './device-detector.service';

describe('DeviceDetectorService', () => {
  let service: DeviceDetectorService;

  const mockUaParser = {
    parse: jest.fn()
  };

  const mockFingerprintService = {
    analyze: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new DeviceDetectorService(
      mockUaParser as any,
      mockFingerprintService as any
    );
  });

  const mockRequest = (ua?: string) =>
    ({
      headers: { 'user-agent': ua }
    }) as any;

  it('should detect device from request', () => {
    mockUaParser.parse.mockReturnValue({
      browserName: 'Chrome',
      browserVersion: '120.0.0.0',
      osName: 'Windows',
      deviceType: 'desktop'
    });

    mockFingerprintService.analyze.mockReturnValue({
      fingerprintRisk: 'low'
    });

    const result = service.detect(
      mockRequest(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      )
    );

    expect(result).toEqual({
      browserName: 'Chrome',
      browserVersion: '120.0.0.0',
      osName: 'Windows',
      deviceType: 'desktop',
      fingerprintRisk: 'low'
    });
  });

  it('should return high risk for empty UA', () => {
    mockUaParser.parse.mockReturnValue({
      browserName: 'unknown',
      browserVersion: 'unknown',
      osName: 'unknown',
      deviceType: 'desktop'
    });

    mockFingerprintService.analyze.mockReturnValue({
      fingerprintRisk: 'high'
    });

    const result = service.detect(mockRequest(undefined));

    expect(result.fingerprintRisk).toBe('high');
  });

  it('should return DeviceContext with all required fields', () => {
    mockUaParser.parse.mockReturnValue({
      browserName: 'Firefox',
      browserVersion: '121.0',
      osName: 'Linux',
      deviceType: 'desktop'
    });

    mockFingerprintService.analyze.mockReturnValue({
      fingerprintRisk: 'low'
    });

    const result = service.detect(mockRequest('Firefox UA'));

    expect(result).toHaveProperty('browserName');
    expect(result).toHaveProperty('browserVersion');
    expect(result).toHaveProperty('osName');
    expect(result).toHaveProperty('deviceType');
    expect(result).toHaveProperty('fingerprintRisk');
  });

  it('should pass parsed result to fingerprint service', () => {
    const parsed = {
      browserName: 'Safari',
      browserVersion: '17.0',
      osName: 'iOS',
      deviceType: 'mobile' as const
    };

    mockUaParser.parse.mockReturnValue(parsed);
    mockFingerprintService.analyze.mockReturnValue({
      fingerprintRisk: 'low'
    });

    service.detect(mockRequest('Safari UA'));

    expect(mockFingerprintService.analyze).toHaveBeenCalledWith(parsed);
  });

  it('should normalize UA before parsing', () => {
    mockUaParser.parse.mockReturnValue({
      browserName: 'Chrome',
      browserVersion: '120.0.0.0',
      osName: 'Windows',
      deviceType: 'desktop'
    });

    mockFingerprintService.analyze.mockReturnValue({
      fingerprintRisk: 'low'
    });

    service.detect(mockRequest('Chrome  Windows'));

    expect(mockUaParser.parse).toHaveBeenCalledWith('Chrome Windows');
  });

  it('should handle missing user-agent header', () => {
    mockUaParser.parse.mockReturnValue({
      browserName: 'unknown',
      browserVersion: 'unknown',
      osName: 'unknown',
      deviceType: 'desktop'
    });

    mockFingerprintService.analyze.mockReturnValue({
      fingerprintRisk: 'high'
    });

    const result = service.detect(mockRequest(undefined));

    expect(mockUaParser.parse).toHaveBeenCalledWith('');
    expect(result.fingerprintRisk).toBe('high');
  });
});
