import { ClockService } from '@infrastructure/services/clock.service';
import { CSRF_TOKEN_TTL_MS, CsrfTokenService } from '../csrf-token.service';

describe('CsrfTokenService', () => {
  const secret = 'test-csrf-secret';
  const sessionId = 'session-id';
  const now = 1710000000000;

  let service: CsrfTokenService;
  let clockService: ClockService;

  beforeEach(() => {
    clockService = new ClockService();
    jest.spyOn(clockService, 'nowMs').mockReturnValue(now);

    service = new CsrfTokenService({ csrfTokenSecret: secret }, clockService);
  });

  describe('issue', () => {
    it('should produce a token in nonce.expiresAt.signature format', () => {
      const token = service.issue(sessionId);
      const parts = token.split('.');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^[0-9a-f]{64}$/);
      expect(Number(parts[1])).toBe(now + CSRF_TOKEN_TTL_MS);
      expect(parts[2]).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce unique tokens for the same session', () => {
      expect(service.issue(sessionId)).not.toBe(service.issue(sessionId));
    });
  });
});
