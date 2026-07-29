import { ClockService } from '@infrastructure/clock/clock.service';
import { CSRF_TOKEN_TTL_MS, CsrfTokenService } from '../csrf-token.service';
import { CsrfValidationService } from '../csrf-validation.service';

describe('CsrfValidationService', () => {
  const secret = 'test-csrf-secret';
  const sessionId = 'session-id';
  const now = 1710000000000;

  let tokenService: CsrfTokenService;
  let validationService: CsrfValidationService;
  let clockService: ClockService;

  beforeEach(() => {
    clockService = new ClockService();
    jest.spyOn(clockService, 'nowMs').mockReturnValue(now);

    tokenService = new CsrfTokenService(
      { csrfTokenSecret: secret },
      clockService
    );
    validationService = new CsrfValidationService(tokenService, clockService);
  });

  describe('validate', () => {
    it('should accept a valid token bound to the session', () => {
      const token = tokenService.issue(sessionId);

      expect(validationService.validate(token, token, sessionId)).toBe(true);
    });

    it('should reject when the header is missing', () => {
      const token = tokenService.issue(sessionId);

      expect(validationService.validate(token, undefined, sessionId)).toBe(
        false
      );
    });

    it('should reject when the cookie is missing', () => {
      const token = tokenService.issue(sessionId);

      expect(validationService.validate(undefined, token, sessionId)).toBe(
        false
      );
    });

    it('should reject when the session id is missing', () => {
      const token = tokenService.issue(sessionId);

      expect(validationService.validate(token, token, undefined)).toBe(false);
    });

    it('should reject when header and cookie differ', () => {
      const cookieToken = tokenService.issue(sessionId);
      const headerToken = tokenService.issue(sessionId);

      expect(
        validationService.validate(cookieToken, headerToken, sessionId)
      ).toBe(false);
    });

    it('should reject a token bound to another session', () => {
      const token = tokenService.issue('other-session-id');

      expect(validationService.validate(token, token, sessionId)).toBe(false);
    });

    it('should reject an expired token', () => {
      const token = tokenService.issue(sessionId);

      jest
        .spyOn(clockService, 'nowMs')
        .mockReturnValue(now + CSRF_TOKEN_TTL_MS);

      expect(validationService.validate(token, token, sessionId)).toBe(false);
    });

    it('should reject a token with a tampered expiry', () => {
      const token = tokenService.issue(sessionId);
      const [nonce, expiresAt, signature] = token.split('.');

      const tampered = `${nonce}.${Number(expiresAt) + 1000}.${signature}`;

      expect(validationService.validate(tampered, tampered, sessionId)).toBe(
        false
      );
    });

    it('should reject a token with a tampered signature', () => {
      const token = tokenService.issue(sessionId);
      const [nonce, expiresAt, signature] = token.split('.');

      const flipped = signature.startsWith('a')
        ? `b${signature.slice(1)}`
        : `a${signature.slice(1)}`;

      const tampered = `${nonce}.${expiresAt}.${flipped}`;

      expect(validationService.validate(tampered, tampered, sessionId)).toBe(
        false
      );
    });

    it('should reject a token signed with a different secret', () => {
      const otherTokenService = new CsrfTokenService(
        { csrfTokenSecret: 'another-secret' },
        clockService
      );
      const token = otherTokenService.issue(sessionId);

      expect(validationService.validate(token, token, sessionId)).toBe(false);
    });

    it('should reject a legacy unsigned token', () => {
      const legacyToken = 'a'.repeat(64);

      expect(
        validationService.validate(legacyToken, legacyToken, sessionId)
      ).toBe(false);
    });

    it('should reject a malformed expiry', () => {
      const token = tokenService.issue(sessionId);
      const [nonce, , signature] = token.split('.');

      const malformed = `${nonce}.not-a-number.${signature}`;

      expect(validationService.validate(malformed, malformed, sessionId)).toBe(
        false
      );
    });
  });
});
