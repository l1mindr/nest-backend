import { createHash } from 'crypto';
import { AdminInvitationTokenService } from '../admin-invitation-token.service';

describe('AdminInvitationTokenService', () => {
  let service: AdminInvitationTokenService;

  beforeEach(() => {
    service = new AdminInvitationTokenService();
  });

  describe('generate', () => {
    it('should produce a url-safe token', () => {
      expect(service.generate()).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    /**
     * 32 bytes base64url-encoded is 43 characters. The DTO accepts 40–64, so a
     * change to the token size that broke acceptance would fail here first.
     */
    it('should carry 256 bits of entropy', () => {
      const token = service.generate();

      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
      expect(token).toHaveLength(43);
    });

    /**
     * Not a proof of randomness — a smoke test that the CSPRNG is actually
     * being drawn from rather than a constant or a seeded generator.
     */
    it('should not repeat across many draws', () => {
      const tokens = new Set(
        Array.from({ length: 1000 }, () => service.generate())
      );

      expect(tokens.size).toBe(1000);
    });
  });

  describe('hash', () => {
    it('should return the hex SHA-256 digest of the token', () => {
      const token = service.generate();

      expect(service.hash(token)).toBe(
        createHash('sha256').update(token).digest('hex')
      );
    });

    /** 64 hex characters — matches the column width the entity declares. */
    it('should produce a 64-character hex digest', () => {
      expect(service.hash(service.generate())).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be deterministic, so a presented token can be looked up', () => {
      const token = service.generate();

      expect(service.hash(token)).toBe(service.hash(token));
    });

    it('should differ for different tokens', () => {
      expect(service.hash(service.generate())).not.toBe(
        service.hash(service.generate())
      );
    });

    /** The stored value must never be the token itself. */
    it('should not return the token', () => {
      const token = service.generate();

      expect(service.hash(token)).not.toBe(token);
    });
  });
});
