import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisLockService } from '@infrastructure/databases/redis/redis-lock.service';
import { RedisService } from '@infrastructure/databases/redis/redis.service';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../bootstrap/test-app';
import { clearRedis } from '../helpers/redis.helper';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls until the lock key is gone instead of sleeping a fixed duration. The
 * assertion is the same (the lock must be released after its TTL) but the wait
 * ends as soon as Redis confirms expiry, so the test is faster and immune to
 * clock drift.
 */
async function waitForLockExpiry(
  redisService: RedisService,
  key: string,
  timeoutMs = 3_000
): Promise<void> {
  const deadline = performance.now() + timeoutMs;

  while (performance.now() < deadline) {
    if ((await redisService.get(key)) === null) return;
    await delay(25);
  }

  throw new Error(`Timed out waiting for lock "${key}" to expire`);
}

/**
 * Exercises the ownership-safe distributed lock against a real Redis so the
 * TTL expiry and the Lua compare-and-delete are validated end to end.
 */
describe('RedisLockService ownership (integration)', () => {
  let app: INestApplication;
  let lockService: RedisLockService;
  let redisService: RedisService;

  const keyFor = (id: string) => `${RedisKey.REFRESH_LOCK}:${id}`;

  beforeAll(async () => {
    const { app: testApp } = await createTestApp();

    app = testApp;
    lockService = app.get(RedisLockService);
    redisService = app.get(RedisService);
  });

  beforeEach(async () => {
    await clearRedis(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('stores the acquisition token as the lock value', async () => {
    const token = await lockService.acquire(RedisKey.REFRESH_LOCK, 'store', 5);

    expect(token).not.toBeNull();
    await expect(redisService.get(keyFor('store'))).resolves.toBe(token);
  });

  it('blocks a concurrent acquire while the lock is held', async () => {
    const held = await lockService.acquire(RedisKey.REFRESH_LOCK, 'busy', 5);
    const contender = await lockService.acquire(
      RedisKey.REFRESH_LOCK,
      'busy',
      5
    );

    expect(held).not.toBeNull();
    expect(contender).toBeNull();
  });

  it('lets the lock expire after its TTL and allows re-acquisition', async () => {
    const first = await lockService.acquire(RedisKey.REFRESH_LOCK, 'expire', 1);
    expect(first).not.toBeNull();

    // Still held immediately after acquiring.
    expect(
      await lockService.acquire(RedisKey.REFRESH_LOCK, 'expire', 1)
    ).toBeNull();

    // Once the TTL elapses the key is gone and can be taken again.
    await waitForLockExpiry(redisService, keyFor('expire'));
    const second = await lockService.acquire(
      RedisKey.REFRESH_LOCK,
      'expire',
      5
    );
    expect(second).not.toBeNull();
  });

  it('gives a second owner a distinct token after the first lock expires', async () => {
    const firstOwner = await lockService.acquire(
      RedisKey.REFRESH_LOCK,
      'handoff',
      1
    );

    await waitForLockExpiry(redisService, keyFor('handoff'));

    const secondOwner = await lockService.acquire(
      RedisKey.REFRESH_LOCK,
      'handoff',
      5
    );

    expect(secondOwner).not.toBeNull();
    expect(secondOwner).not.toBe(firstOwner);
    await expect(redisService.get(keyFor('handoff'))).resolves.toBe(
      secondOwner
    );
  });

  it('does not let a stale owner release a lock re-acquired by a new owner', async () => {
    // Old owner takes a short-lived lock that then expires.
    const staleToken = await lockService.acquire(
      RedisKey.REFRESH_LOCK,
      'race',
      1
    );
    expect(staleToken).not.toBeNull();
    await waitForLockExpiry(redisService, keyFor('race'));

    // New owner acquires the freed lock.
    const currentToken = await lockService.acquire(
      RedisKey.REFRESH_LOCK,
      'race',
      5
    );
    expect(currentToken).not.toBeNull();

    // Old owner's late release must be a no-op: the token no longer matches.
    const releasedByStale = await lockService.release(
      RedisKey.REFRESH_LOCK,
      'race',
      staleToken as string
    );
    expect(releasedByStale).toBe(false);

    // The new owner's lock is still intact.
    await expect(redisService.get(keyFor('race'))).resolves.toBe(currentToken);

    // And the rightful owner can release it.
    const releasedByOwner = await lockService.release(
      RedisKey.REFRESH_LOCK,
      'race',
      currentToken as string
    );
    expect(releasedByOwner).toBe(true);
    await expect(redisService.get(keyFor('race'))).resolves.toBeNull();
  });
});
