import { Request } from 'express';
import { SecurityHasher } from '../../../hashing/security-hasher.service';
import { DeviceIdService } from '../device-id.service';

describe('DeviceIdService', () => {
  let service: DeviceIdService;

  // A real hasher keeps the determinism assertions meaningful: a stub returning
  // a constant would pass every "same input, same id" test vacuously.
  const hasher = new SecurityHasher({
    hashSecret: 'test-security-hash-secret'
  } as any) as SecurityHasher;

  beforeEach(() => {
    service = new DeviceIdService(hasher);
  });

  const mockRequest = (
    overrides: {
      ip?: string;
      deviceIdHeader?: string | string[];
      acceptLanguage?: string;
    } = {}
  ) =>
    ({
      ip: overrides.ip ?? '203.0.113.10',
      headers: {
        ...(overrides.deviceIdHeader === undefined
          ? {}
          : { 'x-device-id': overrides.deviceIdHeader }),
        ...(overrides.acceptLanguage === undefined
          ? {}
          : { 'accept-language': overrides.acceptLanguage })
      }
    }) as unknown as Request;

  const VALID_HEADER = 'device-abc123XYZ_-';

  describe('client-supplied header', () => {
    it('should prefer a well-formed header', () => {
      const identity = service.resolve(
        mockRequest({ deviceIdHeader: VALID_HEADER }),
        'Chrome UA'
      );

      expect(identity.deviceIdSource).toBe('header');
    });

    it('should hash the header rather than using it verbatim', () => {
      const identity = service.resolve(
        mockRequest({ deviceIdHeader: VALID_HEADER }),
        'Chrome UA'
      );

      expect(identity.deviceId).not.toContain(VALID_HEADER);
      expect(identity.deviceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should still populate the derived id alongside the header id', () => {
      const identity = service.resolve(
        mockRequest({ deviceIdHeader: VALID_HEADER }),
        'Chrome UA'
      );

      expect(identity.derivedDeviceId).toMatch(/^[0-9a-f]{32}$/);
      expect(identity.derivedDeviceId).not.toBe(identity.deviceId);
    });

    it('should keep the header id stable across addresses', () => {
      const first = service.resolve(
        mockRequest({ deviceIdHeader: VALID_HEADER, ip: '203.0.113.10' }),
        'Chrome UA'
      );
      const second = service.resolve(
        mockRequest({ deviceIdHeader: VALID_HEADER, ip: '198.51.100.10' }),
        'Chrome UA'
      );

      expect(first.deviceId).toBe(second.deviceId);
    });

    it('should give a different bucket to a different header value', () => {
      const first = service.resolve(
        mockRequest({ deviceIdHeader: VALID_HEADER }),
        'Chrome UA'
      );
      const second = service.resolve(
        mockRequest({ deviceIdHeader: 'device-completely-other' }),
        'Chrome UA'
      );

      expect(first.deviceId).not.toBe(second.deviceId);
    });

    it.each([
      ['too short', 'abc'],
      ['too long', 'a'.repeat(129)],
      ['illegal characters', 'device id with spaces'],
      ['empty', ''],
      ['a repeated header', ['device-abc123XYZ', 'device-other456'] as string[]]
    ])('should fall back to the derived id for %s', (_case, header) => {
      const identity = service.resolve(
        mockRequest({ deviceIdHeader: header }),
        'Chrome UA'
      );

      expect(identity.deviceIdSource).toBe('derived');
      expect(identity.deviceId).toBe(identity.derivedDeviceId);
    });
  });

  describe('derived identifier', () => {
    it('should be identical for two addresses in the same /24', () => {
      const first = service.resolve(mockRequest({ ip: '203.0.113.1' }), 'UA');
      const second = service.resolve(
        mockRequest({ ip: '203.0.113.250' }),
        'UA'
      );

      expect(first.deviceId).toBe(second.deviceId);
    });

    it('should differ across /24s', () => {
      const first = service.resolve(mockRequest({ ip: '203.0.113.1' }), 'UA');
      const second = service.resolve(mockRequest({ ip: '203.0.114.1' }), 'UA');

      expect(first.deviceId).not.toBe(second.deviceId);
    });

    it('should differ across user agents', () => {
      const first = service.resolve(mockRequest(), 'Chrome UA');
      const second = service.resolve(mockRequest(), 'Firefox UA');

      expect(first.deviceId).not.toBe(second.deviceId);
    });

    it('should differ across accept-language values', () => {
      const first = service.resolve(
        mockRequest({ acceptLanguage: 'en-US' }),
        'UA'
      );
      const second = service.resolve(
        mockRequest({ acceptLanguage: 'fr-FR' }),
        'UA'
      );

      expect(first.deviceId).not.toBe(second.deviceId);
    });

    it('should tolerate a missing accept-language header', () => {
      const identity = service.resolve(mockRequest(), 'UA');

      expect(identity.deviceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should tolerate a missing address', () => {
      const identity = service.resolve(
        mockRequest({ ip: undefined }) as Request,
        'UA'
      );

      expect(identity.deviceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should report the derived source and mirror both ids', () => {
      const identity = service.resolve(mockRequest(), 'UA');

      expect(identity.deviceIdSource).toBe('derived');
      expect(identity.deviceId).toBe(identity.derivedDeviceId);
    });
  });
});
