import { RedisKey } from '@infrastructure/databases/redis/keys/redis-key.enum';
import { RedisService } from '@infrastructure/databases/redis/redis.service';
import { Injectable } from '@nestjs/common';
import { AuthTokens } from '../interfaces/auth.interface';

/**
 * Grace window for the rotation race, in seconds.
 *
 * Sized to the gap this application actually creates: the Next.js proxy can
 * refresh server-side while the browser's own single-flight refresh is already
 * in flight, and a request that left before the winner's `Set-Cookie` landed
 * still carries the previous token. That gap is network-scale — sub-second in
 * practice — so ten seconds is already generous. It sits just above the
 * five-second Redis refresh lock so a request that queued behind the lock is
 * still inside the window when it runs.
 *
 * Deliberately a constant rather than configuration: the whole security
 * argument below rests on this being short, and an environment variable is an
 * invitation to quietly widen it into a general-purpose multi-use token.
 */
export const REFRESH_REPLAY_GRACE_SECONDS = 10;

interface RefreshReplayRecord extends AuthTokens {
  /**
   * Session version the consumed token was valid at — that is, the version
   * read immediately before the rotation this record describes. Used to refuse
   * anything older than exactly one generation back.
   */
  version: number;
}

/**
 * Short-lived, session-scoped memory of what a just-consumed refresh token
 * rotated into.
 *
 * Rotation is single-use by design: the instant R1 becomes R2, a second
 * request still holding R1 fails the hash comparison and is treated as replay.
 * That is the right answer for a stolen token and the wrong one for the
 * ordinary race this app creates on purpose — two frontend processes (the
 * proxy and the browser) refresh against one cookie jar and cannot share
 * in-memory single-flight state, so a legitimate user occasionally gets logged
 * out for a race they did not cause.
 *
 * So the pair R1 rotated into is remembered for {@link
 * REFRESH_REPLAY_GRACE_SECONDS}, and a racing request presenting R1 inside
 * that window is handed back *exactly* the pair the winner received. One
 * logical rotation, no second generation, nothing that can be chained.
 *
 * What keeps this from becoming a multi-use refresh token:
 *
 *  - **Keyed by hash, never the token.** The lookup key is the SHA-256 digest
 *    the session table already stores, so a token is not recoverable from
 *    Redis by reading a key name.
 *  - **One generation only.** The record carries the session version its token
 *    was valid at; {@link find} refuses anything that is not exactly one
 *    rotation behind the session's current version. R1 after R2 has already
 *    rotated to R3 is two generations back and is refused, so replay detection
 *    fires exactly as it did before.
 *  - **Time bounded and non-renewable.** The TTL is set once at write time and
 *    never extended; serving a record does not refresh it.
 *  - **Session scoped.** The key is namespaced by session id, so a record can
 *    only ever resolve a refresh for the session that created it.
 *
 * The stored value is a bearer token pair at rest for those few seconds. Redis
 * is already the trust-boundary store for session locks and rate-limit
 * counters, and the exposure is bounded by the same TTL; it is the price of
 * returning the winner's exact result instead of minting a second lineage,
 * which is what would actually be unsafe.
 */
@Injectable()
export class RefreshReplayService {
  constructor(private readonly redisService: RedisService) {}

  private key(sessionId: string, consumedTokenHash: string): string {
    return `${RedisKey.REFRESH_REPLAY}:${sessionId}:${consumedTokenHash}`;
  }

  /**
   * Records that `consumedTokenHash` rotated into `tokens` while the session
   * stood at `version`. Called only after a rotation has actually committed.
   */
  async remember(
    sessionId: string,
    consumedTokenHash: string,
    version: number,
    tokens: AuthTokens
  ): Promise<void> {
    const record: RefreshReplayRecord = { ...tokens, version };

    await this.redisService.setWithExpiry(
      this.key(sessionId, consumedTokenHash),
      JSON.stringify(record),
      REFRESH_REPLAY_GRACE_SECONDS
    );
  }

  /**
   * The pair `presentedTokenHash` rotated into, or `null` when there is no
   * record, it has expired, or it is more than one generation behind
   * `currentVersion` — every one of which must be treated as replay.
   */
  async find(
    sessionId: string,
    presentedTokenHash: string,
    currentVersion: number
  ): Promise<AuthTokens | null> {
    const raw = await this.redisService.get(
      this.key(sessionId, presentedTokenHash)
    );

    if (!raw) return null;

    let record: RefreshReplayRecord;

    try {
      record = JSON.parse(raw) as RefreshReplayRecord;
    } catch {
      return null;
    }

    // Exactly one rotation may separate the presented token from the session's
    // current state. Anything else is an older generation replaying.
    if (record.version !== currentVersion - 1) {
      return null;
    }

    return {
      accessToken: record.accessToken,
      refreshToken: record.refreshToken
    };
  }
}
