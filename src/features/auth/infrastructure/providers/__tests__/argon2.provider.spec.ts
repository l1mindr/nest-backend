import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import { Argon2Provider } from '../argon2.provider';

const TEST_OPTIONS = {
  memoryCost: 8192,
  timeCost: 1,
  parallelism: 1
};

describe('Argon2Provider', () => {
  let provider: Argon2Provider;

  const mockLogger = {
    setContext: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  };

  const configService = (values: Record<string, number> = {}) =>
    ({
      get: jest.fn((key: string) => values[key])
    }) as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();

    provider = new Argon2Provider(configService(), mockLogger as any);
  });

  describe('hash', () => {
    it('should produce an Argon2id hash', async () => {
      const hash = await provider.hash('CorrectHorseBatteryStaple');

      expect(hash.startsWith('$argon2id$v=19$')).toBe(true);
    });

    it('should produce a unique salt per hash', async () => {
      const first = await provider.hash('password');
      const second = await provider.hash('password');

      expect(first).not.toBe(second);
    });

    it('should honour the configured memory cost', async () => {
      const provider = new Argon2Provider(
        configService({
          ARGON2_MEMORY_COST: 8192,
          ARGON2_TIME_COST: 1,
          ARGON2_PARALLELISM: 1,
          ARGON2_HASH_LENGTH: 32
        }),
        mockLogger as any
      );

      const hash = await provider.hash('password');

      expect(hash).toContain('m=8192');
    });
  });

  describe('compare', () => {
    it('should accept a matching Argon2id password', async () => {
      const hash = await provider.hash('password123');

      await expect(provider.compare('password123', hash)).resolves.toBe(true);
    });

    it('should reject a wrong Argon2id password', async () => {
      const hash = await provider.hash('password123');

      await expect(provider.compare('wrong-password', hash)).resolves.toBe(
        false
      );
    });

    it('should accept a matching legacy bcrypt password', async () => {
      const legacyHash = bcrypt.hashSync('legacy-password', 4);

      await expect(
        provider.compare('legacy-password', legacyHash)
      ).resolves.toBe(true);
    });

    it('should reject a wrong legacy bcrypt password', async () => {
      const legacyHash = bcrypt.hashSync('legacy-password', 4);

      await expect(
        provider.compare('wrong-password', legacyHash)
      ).resolves.toBe(false);
    });

    it.each([
      ['Argon2i', argon2.argon2i],
      ['Argon2d', argon2.argon2d]
    ] as const)(
      'should reject an unsupported %s hash even when the password matches',
      async (_: string, type: 0 | 1) => {
        const unsupportedHash = await argon2.hash('password123', {
          ...TEST_OPTIONS,
          type
        });

        await expect(
          provider.compare('password123', unsupportedHash)
        ).resolves.toBe(false);
      }
    );

    it.each([
      ['plain text', 'not-a-hash'],
      ['no variant bcrypt', '$2$10$no-variant-letter'],
      ['truncated argon2id', '$argon2id$v=19$truncated']
    ])('should reject %s as an unsupported format', async (_, hash) => {
      await expect(provider.compare('password123', hash)).resolves.toBe(false);
    });

    it('should treat a malformed bcrypt hash as a mismatch instead of throwing', async () => {
      await expect(
        provider.compare('password123', '$2b$10$too-short')
      ).resolves.toBe(false);
    });

    it('should treat a malformed argon2id hash as a mismatch instead of throwing', async () => {
      await expect(
        provider.compare('password123', '$argon2id$v=19$garbage')
      ).resolves.toBe(false);
    });
  });

  describe('needsMigration', () => {
    it('should report true for a bcrypt hash', () => {
      const legacyHash = bcrypt.hashSync('password', 4);

      expect(provider.needsMigration(legacyHash)).toBe(true);
    });

    it('should report false for an Argon2id hash', async () => {
      const hash = await provider.hash('password');

      expect(provider.needsMigration(hash)).toBe(false);
    });

    it('should report false for an unsupported format', () => {
      expect(provider.needsMigration('garbage')).toBe(false);
    });
  });
});
