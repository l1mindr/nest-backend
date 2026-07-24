import { UserAgentParser } from './user-agent.parser';

describe('UserAgentParser', () => {
  let parser: UserAgentParser;

  beforeEach(() => {
    parser = new UserAgentParser();
  });

  describe('Chrome on Windows', () => {
    it('should parse desktop Chrome correctly', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      const result = parser.parse(ua);

      expect(result).toEqual({
        browserName: 'Chrome',
        browserVersion: '120.0.0.0',
        osName: 'Windows',
        deviceType: 'desktop'
      });
    });
  });

  describe('Safari on macOS', () => {
    it('should parse macOS Safari correctly', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';

      const result = parser.parse(ua);

      expect(result).toEqual({
        browserName: 'Safari',
        browserVersion: '17.2',
        osName: 'macOS',
        deviceType: 'desktop'
      });
    });
  });

  describe('Mobile Chrome on Android', () => {
    it('should detect mobile device type', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

      const result = parser.parse(ua);

      expect(result).toEqual({
        browserName: 'Mobile Chrome',
        browserVersion: '120.0.0.0',
        osName: 'Android',
        deviceType: 'mobile'
      });
    });
  });

  describe('Safari on iPhone', () => {
    it('should detect iOS mobile device', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';

      const result = parser.parse(ua);

      expect(result).toEqual({
        browserName: 'Mobile Safari',
        browserVersion: '17.2',
        osName: 'iOS',
        deviceType: 'mobile'
      });
    });
  });

  describe('iPad', () => {
    it('should detect tablet device type', () => {
      const ua =
        'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';

      const result = parser.parse(ua);

      expect(result).toEqual({
        browserName: 'Mobile Safari',
        browserVersion: '17.2',
        osName: 'iOS',
        deviceType: 'tablet'
      });
    });
  });

  describe('empty UA string', () => {
    it('should return unknown fields and desktop for empty string', () => {
      const result = parser.parse('');

      expect(result).toEqual({
        browserName: 'unknown',
        browserVersion: 'unknown',
        osName: 'unknown',
        deviceType: 'desktop'
      });
    });
  });

  describe('unrecognized UA string', () => {
    it('should default to unknown for unrecognized input', () => {
      const result = parser.parse('some-random-bot-string/1.0');

      expect(result).toEqual({
        browserName: 'unknown',
        browserVersion: 'unknown',
        osName: 'unknown',
        deviceType: 'desktop'
      });
    });
  });

  describe('return type', () => {
    it('should always return all four IUserAgent fields', () => {
      const result = parser.parse('');

      expect(result).toHaveProperty('browserName');
      expect(result).toHaveProperty('browserVersion');
      expect(result).toHaveProperty('osName');
      expect(result).toHaveProperty('deviceType');
    });

    it('should never return undefined for any field', () => {
      const result = parser.parse('');

      expect(result.browserName).toBeDefined();
      expect(result.browserVersion).toBeDefined();
      expect(result.osName).toBeDefined();
      expect(result.deviceType).toBeDefined();
    });

    it('should only return valid deviceType values', () => {
      const validTypes = ['mobile', 'tablet', 'desktop'];

      const result = parser.parse('');

      expect(validTypes).toContain(result.deviceType);
    });
  });
});
