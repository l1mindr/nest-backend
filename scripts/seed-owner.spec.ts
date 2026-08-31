import { User } from '../src/features/users/domain/entities/user.entity';
import { UserRole } from '../src/features/users/domain/enums/user-role.enum';
import { UserStatus } from '../src/features/users/domain/enums/user-status.enum';
import { HashingProvider } from '../src/features/auth/infrastructure/providers/hashing.provider';
import { bootstrapOwner } from './seed-owner';

describe('seed-owner bootstrapOwner', () => {
  const email = 'owner@example.com';
  const password = 'Owner@12345';

  function buildDeps(overrides: {
    existing?: Pick<User, 'id' | 'email' | 'role'> | null;
    saveRejects?: unknown;
    hash?: typeof jest.fn;
  }) {
    const repo = {
      findOne: jest.fn().mockResolvedValue(overrides.existing ?? null),
      create: jest.fn((entity: Partial<User>) => ({ id: 'new-id', ...entity })),
      save: overrides.saveRejects
        ? jest.fn().mockRejectedValue(overrides.saveRejects)
        : jest.fn().mockResolvedValue({ id: 'new-id' })
    };

    const dataSource = { getRepository: jest.fn().mockReturnValue(repo) };
    const hashingProvider = {
      hash: overrides.hash ?? jest.fn().mockResolvedValue('$argon2id$hashed')
    } as unknown as HashingProvider;

    return {
      deps: { dataSource: dataSource as never, hashingProvider },
      repo,
      dataSource
    };
  }

  it('creates an OWNER with ACTIVATE status and a hashed password when none exists', async () => {
    const { deps, repo, dataSource } = buildDeps({});

    const outcome = await bootstrapOwner(deps, email, password);

    expect(outcome.created).toBe(true);
    expect(outcome.email).toBe(email);

    expect(dataSource.getRepository).toHaveBeenCalledWith(User);
    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: UserRole.OWNER } })
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email,
        role: UserRole.OWNER,
        status: UserStatus.ACTIVATE
      })
    );
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('hashes the password before persisting (via the hashing provider)', async () => {
    const hash = jest.fn().mockResolvedValue('$argon2id$hashed');
    const { deps, repo } = buildDeps({ hash });

    await bootstrapOwner(deps, email, password);

    expect(hash).toHaveBeenCalledWith(password);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ password: '$argon2id$hashed' })
    );
  });

  it('is idempotent: does not insert when an Owner already exists', async () => {
    const existing = { id: 'owner-1', email, role: UserRole.OWNER } as User;
    const { deps, repo } = buildDeps({ existing });

    const outcome = await bootstrapOwner(deps, email, password);

    expect(outcome.created).toBe(false);
    expect(outcome.email).toBe(email);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('reports already-exists when a concurrent insert violates the single-owner unique index', async () => {
    const { deps } = buildDeps({
      saveRejects: { code: '23505', message: 'duplicate key value' }
    });

    const outcome = await bootstrapOwner(deps, email, password);

    expect(outcome.created).toBe(false);
    expect(outcome.email).toBe(email);
  });

  it('propagates non-unique insert errors', async () => {
    const { deps } = buildDeps({
      saveRejects: new Error('database down')
    });

    await expect(bootstrapOwner(deps, email, password)).rejects.toThrow(
      'database down'
    );
  });
});
