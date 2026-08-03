import { toSubnet, UNKNOWN_SUBNET } from '../ip-subnet.util';

describe('toSubnet', () => {
  describe('IPv4', () => {
    it('should keep the /24 network portion', () => {
      expect(toSubnet('203.0.113.42')).toBe('203.0.113');
    });

    it('should map every host in one /24 to the same subnet', () => {
      expect(toSubnet('198.51.100.1')).toBe(toSubnet('198.51.100.254'));
    });

    it('should separate different /24s', () => {
      expect(toSubnet('198.51.100.1')).not.toBe(toSubnet('198.51.101.1'));
    });

    it('should reject an out-of-range octet', () => {
      expect(toSubnet('203.0.113.999')).toBe(UNKNOWN_SUBNET);
    });
  });

  describe('IPv6', () => {
    it('should keep the /64 network portion', () => {
      expect(toSubnet('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(
        '2001:0db8:85a3:0000'
      );
    });

    it('should expand :: before truncating', () => {
      // 2001:db8:: expands to 2001:db8:0:0:..., so the /64 is the first four.
      expect(toSubnet('2001:db8::1')).toBe('2001:db8:0:0');
    });

    it('should map two hosts in one /64 to the same subnet', () => {
      expect(toSubnet('2001:db8:85a3:1::1')).toBe(
        toSubnet('2001:db8:85a3:1::ffff')
      );
    });

    it('should separate different /64s', () => {
      expect(toSubnet('2001:db8:85a3:1::1')).not.toBe(
        toSubnet('2001:db8:85a3:2::1')
      );
    });

    it('should lowercase before comparing', () => {
      expect(toSubnet('2001:DB8:85A3:1::1')).toBe(
        toSubnet('2001:db8:85a3:1::1')
      );
    });

    it('should reject more than one :: run', () => {
      expect(toSubnet('2001::db8::1')).toBe(UNKNOWN_SUBNET);
    });

    it('should reject an uncompressed address with too few hextets', () => {
      expect(toSubnet('2001:db8:85a3:1')).toBe(UNKNOWN_SUBNET);
    });
  });

  describe('IPv4-mapped IPv6', () => {
    it('should unwrap ::ffff: and treat it as IPv4', () => {
      expect(toSubnet('::ffff:203.0.113.42')).toBe('203.0.113');
    });

    it('should yield the same subnet on either stack', () => {
      expect(toSubnet('::ffff:198.51.100.7')).toBe(toSubnet('198.51.100.7'));
    });
  });

  describe('unparseable input', () => {
    it.each([undefined, '', '   ', 'not-an-ip'])(
      'should return the unknown subnet for %p',
      (value) => {
        expect(toSubnet(value)).toBe(UNKNOWN_SUBNET);
      }
    );
  });
});
