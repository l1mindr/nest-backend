import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { sanitizeMetadata } from '@infrastructure/logging/audit/metadata-sanitizer';
import { isValidActivityPair } from '../../domain/activity-catalog';
import {
  IUserActivityRecorder,
  IUserActivityRepository,
  RecordActivityInput,
  USER_ACTIVITY_REPOSITORY
} from '../interfaces/activity.interface';

/**
 * The single way an activity gets written.
 *
 * ## Why this never throws
 *
 * An activity describes something that has *already happened*. By the time a
 * call site reaches this service its transaction is committed and its response
 * is decided, so there is no longer a meaningful way to fail: rejecting here
 * would turn a portfolio that was genuinely created into a 500, and the user
 * would retry an operation that already succeeded. So every failure path ends
 * in a log line and a return.
 *
 * That is also why `record` is synchronous and returns `void`. Handing back a
 * promise would invite `await`, which would put MongoDB latency on the request
 * path for a write nothing is waiting on — and would make an unhandled
 * rejection possible at every call site.
 *
 * Deliberately simple: no queue, no outbox, no event bus. Losing a row on a
 * MongoDB outage means one line missing from a history screen, which does not
 * justify the operational weight of guaranteed delivery.
 */
@Injectable()
export class UserActivityRecorderService implements IUserActivityRecorder {
  constructor(
    @Inject(USER_ACTIVITY_REPOSITORY)
    private readonly repository: IUserActivityRepository,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(UserActivityRecorderService.name);
  }

  record(input: RecordActivityInput): void {
    if (!this.isRecordable(input)) {
      return;
    }

    this.repository
      .create({
        userId: input.userId,
        category: input.category,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        // Screened here as well as in the repository. This is the layer that
        // knows what a call site passed, so it is the one whose log line can
        // point at the caller when something sensitive shows up.
        metadata: sanitizeMetadata(input.metadata ?? undefined) ?? null
      })
      .catch((error: unknown) => {
        this.logger.error(
          {
            category: input.category,
            action: input.action,
            userId: input.userId,
            err: error instanceof Error ? error : undefined
          },
          'Failed to record user activity; the business operation was unaffected'
        );
      });
  }

  /**
   * Rejects records that could never render.
   *
   * Both checks are programming errors rather than user input — the userId
   * comes from the authenticated principal and the pair from a literal at the
   * call site — so they are logged and dropped rather than raised: a typo in a
   * call site should not be able to fail a request that already succeeded.
   */
  private isRecordable(input: RecordActivityInput): boolean {
    if (!input.userId) {
      this.logger.error(
        { category: input.category, action: input.action },
        'Refusing to record user activity without a user id'
      );
      return false;
    }

    if (!isValidActivityPair(input.category, input.action)) {
      this.logger.error(
        {
          category: input.category,
          action: input.action,
          userId: input.userId
        },
        'Refusing to record user activity with an action its category does not allow'
      );
      return false;
    }

    return true;
  }
}
