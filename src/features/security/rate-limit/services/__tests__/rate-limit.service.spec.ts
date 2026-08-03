import { RateLimitIdentifier } from '../../types/rate-limit-identifier.enum';
import { RateLimitRule } from '../../types/rate-limit-rule.interface';
import { RateLimitStoreService } from '../rate-limit-store.service';
import { RateLimitService } from '../rate-limit.service';

const rule = (overrides: Partial<RateLimitRule> = {}): RateLimitRule => ({
  name: 'auth.login.ip',
  identifier: RateLimitIdentifier.IP,
  keyPrefix: 'login',
  limit: 5,
  windowMs: 60_000,
  blockDurationMs: 0,
  enabled: true,
  failOpen: true,
  ...overrides
});

describe('RateLimitService', () => {
  let service: RateLimitService;

  const mockStore = {
    consume: jest.fn(),
    peek: jest.fn(),
    reset: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new RateLimitService(
      mockStore as unknown as RateLimitStoreService
    );
  });

  describe('consume', () => {
    it('should delegate to the store with a default cost of one', async () => {
      mockStore.consume.mockResolvedValue({ allowed: true });

      await service.consume(rule(), '203.0.113.10');

      expect(mockStore.consume).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'auth.login.ip' }),
        '203.0.113.10',
        1
      );
    });

    it('should forward an explicit cost', async () => {
      mockStore.consume.mockResolvedValue({ allowed: true });

      await service.consume(rule(), '203.0.113.10', 4);

      expect(mockStore.consume).toHaveBeenCalledWith(
        expect.anything(),
        '203.0.113.10',
        4
      );
    });

    it('should allow without spending budget when the rule is disabled', async () => {
      const result = await service.consume(
        rule({ enabled: false }),
        '203.0.113.10'
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(mockStore.consume).not.toHaveBeenCalled();
    });
  });

  describe('peek', () => {
    it('should delegate to the store', async () => {
      mockStore.peek.mockResolvedValue({ allowed: true });

      await service.peek(rule(), '203.0.113.10');

      expect(mockStore.peek).toHaveBeenCalledWith(
        expect.anything(),
        '203.0.113.10'
      );
    });

    it('should short-circuit a disabled rule', async () => {
      const result = await service.peek(
        rule({ enabled: false }),
        '203.0.113.10'
      );

      expect(result.allowed).toBe(true);
      expect(mockStore.peek).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should delegate to the store', async () => {
      await service.reset(rule(), 'user-1');

      expect(mockStore.reset).toHaveBeenCalledWith(expect.anything(), 'user-1');
    });

    it('should reset even a disabled rule so stale counters can be cleared', async () => {
      await service.reset(rule({ enabled: false }), 'user-1');

      expect(mockStore.reset).toHaveBeenCalled();
    });
  });
});
