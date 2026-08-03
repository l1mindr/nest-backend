import { DeviceDetectorService } from '../device-detector.service';

describe('DeviceDetectorService', () => {
  let service: DeviceDetectorService;

  const mockUaParser = {
    parse: jest.fn()
  };

  const mockFingerprintService = {
    analyze: jest.fn()
  };

  const DEVICE_IDENTITY = {
    deviceId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    derivedDeviceId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    deviceIdSource: 'derived' as const
  };

  const mockDeviceIdService = {
    resolve: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDeviceIdService.resolve.mockReturnValue(DEVICE_IDENTITY);

    service = new DeviceDetectorService(
      mockUaParser as any,
      mockFingerprintService as any,
      mockDeviceIdService as any
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
      fingerprintRisk: 'low',
      ...DEVICE_IDENTITY
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
    expect(result).toHaveProperty('deviceId');
    expect(result).toHaveProperty('derivedDeviceId');
    expect(result).toHaveProperty('deviceIdSource');
  });

  it('should resolve the device identity from the normalized user agent', () => {
    mockUaParser.parse.mockReturnValue({
      browserName: 'Chrome',
      browserVersion: '120.0.0.0',
      osName: 'Windows',
      deviceType: 'desktop'
    });

    mockFingerprintService.analyze.mockReturnValue({
      fingerprintRisk: 'low'
    });

    const request = mockRequest('Chrome  Windows');

    service.detect(request);

    expect(mockDeviceIdService.resolve).toHaveBeenCalledWith(
      request,
      'Chrome Windows'
    );
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
