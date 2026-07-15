import { ClockService } from '@core/clock/clock.service';
import { CSRF_TOKEN_TTL_MS, CsrfService } from './csrf.service';

describe('CsrfService', () => {
  const secret = 'test-csrf-secret';
  const sessionId = 'session-id';
  const now = 1710000000000;

  let service: CsrfService;
  let clockService: ClockService;

  beforeEach(() => {
    clockService = new ClockService();
    jest.spyOn(clockService, 'nowMs').mockReturnValue(now);

    service = new CsrfService({ csrfTokenSecret: secret }, clockService);
  });

  describe('generateToken', () => {
    it('should produce a token in nonce.expiresAt.signature format', () => {
      const token = service.generateToken(sessionId);
      const parts = token.split('.');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^[0-9a-f]{64}$/);
      expect(Number(parts[1])).toBe(now + CSRF_TOKEN_TTL_MS);
      expect(parts[2]).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce unique tokens for the same session', () => {
      expect(service.generateToken(sessionId)).not.toBe(
        service.generateToken(sessionId)
      );
    });
  });

  describe('validate', () => {
    it('should accept a valid token bound to the session', () => {
      const token = service.generateToken(sessionId);

      expect(service.validate(token, token, sessionId)).toBe(true);
    });

    it('should reject when the header is missing', () => {
      const token = service.generateToken(sessionId);

      expect(service.validate(token, undefined, sessionId)).toBe(false);
    });

    it('should reject when the cookie is missing', () => {
      const token = service.generateToken(sessionId);

      expect(service.validate(undefined, token, sessionId)).toBe(false);
    });

    it('should reject when the session id is missing', () => {
      const token = service.generateToken(sessionId);

      expect(service.validate(token, token, undefined)).toBe(false);
    });

    it('should reject when header and cookie differ', () => {
      const cookieToken = service.generateToken(sessionId);
      const headerToken = service.generateToken(sessionId);

      expect(service.validate(cookieToken, headerToken, sessionId)).toBe(false);
    });

    it('should reject a token bound to another session', () => {
      const token = service.generateToken('other-session-id');

      expect(service.validate(token, token, sessionId)).toBe(false);
    });

    it('should reject an expired token', () => {
      const token = service.generateToken(sessionId);

      jest
        .spyOn(clockService, 'nowMs')
        .mockReturnValue(now + CSRF_TOKEN_TTL_MS);

      expect(service.validate(token, token, sessionId)).toBe(false);
    });

    it('should reject a token with a tampered expiry', () => {
      const token = service.generateToken(sessionId);
      const [nonce, expiresAt, signature] = token.split('.');

      const tampered = `${nonce}.${Number(expiresAt) + 1000}.${signature}`;

      expect(service.validate(tampered, tampered, sessionId)).toBe(false);
    });

    it('should reject a token with a tampered signature', () => {
      const token = service.generateToken(sessionId);
      const [nonce, expiresAt, signature] = token.split('.');

      const flipped = signature.startsWith('a')
        ? `b${signature.slice(1)}`
        : `a${signature.slice(1)}`;

      const tampered = `${nonce}.${expiresAt}.${flipped}`;

      expect(service.validate(tampered, tampered, sessionId)).toBe(false);
    });

    it('should reject a token signed with a different secret', () => {
      const otherService = new CsrfService(
        { csrfTokenSecret: 'another-secret' },
        clockService
      );

      const token = otherService.generateToken(sessionId);

      expect(service.validate(token, token, sessionId)).toBe(false);
    });

    it('should reject a legacy unsigned token', () => {
      const legacyToken = 'a'.repeat(64);

      expect(service.validate(legacyToken, legacyToken, sessionId)).toBe(false);
    });

    it('should reject a malformed expiry', () => {
      const token = service.generateToken(sessionId);
      const [nonce, , signature] = token.split('.');

      const malformed = `${nonce}.not-a-number.${signature}`;

      expect(service.validate(malformed, malformed, sessionId)).toBe(false);
    });
  });
});
