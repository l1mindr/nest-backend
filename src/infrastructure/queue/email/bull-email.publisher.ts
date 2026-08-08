import { ClockService } from '@infrastructure/clock/clock.service';
import {
  EmailPublishOptions,
  EmailPublisher
} from '@infrastructure/email/email.publisher';
import { EmailMessage } from '@infrastructure/email/email.message';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import queueConfig from '../queue.config';
import { EMAIL_QUEUE, SEND_EMAIL_JOB } from '../queue.constants';
import { EmailJob } from './email.job';

@Injectable()
export class BullEmailPublisher extends EmailPublisher {
  private readonly options: ConfigType<typeof queueConfig>['email'];

  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<EmailJob>,
    @Inject(queueConfig.KEY) config: ConfigType<typeof queueConfig>,
    private readonly clockService: ClockService,
    private readonly logger: PinoLogger
  ) {
    super();
    this.options = config.email;
    this.logger.setContext(BullEmailPublisher.name);
  }

  async publish(
    message: EmailMessage,
    options: EmailPublishOptions = {}
  ): Promise<void> {
    const job: EmailJob = {
      message,
      queuedAt: this.clockService.nowDate().toISOString()
    };

    try {
      const queued = await this.withPublishTimeout(
        this.queue.add(SEND_EMAIL_JOB, job, {
          // BullMQ treats a repeated job id as the job it already holds, which
          // is what makes a re-run of the calling use case send one email
          // rather than two.
          jobId: options.dedupeKey,
          attempts: this.options.attempts,
          backoff: { type: 'exponential', delay: this.options.backoffMs },
          removeOnComplete: { count: this.options.keepCompleted },
          removeOnFail: { count: this.options.keepFailed }
        })
      );

      this.logger.info(
        {
          event: LogEvent.EMAIL_JOB_QUEUED,
          jobId: queued.id,
          messageType: message.type,
          to: message.to
        },
        'Email queued for delivery'
      );
    } catch (error: unknown) {
      // The database state this email describes is already committed, so the
      // request stands and the email is what is lost. Reported at error level
      // because a queue that cannot be written to is an outage, not a nuisance.
      this.logger.error(
        {
          event: LogEvent.EMAIL_JOB_QUEUE_FAILED,
          messageType: message.type,
          to: message.to,
          err: error
        },
        'Email could not be queued and will not be delivered'
      );
    }
  }

  /**
   * ioredis buffers commands while it reconnects, so an unreachable Redis makes
   * `add` pend rather than reject. Publishing sits on the request path, so it
   * gets a deadline of its own.
   */
  private withPublishTimeout<T>(operation: Promise<T>): Promise<T> {
    const { publishTimeoutMs } = this.options;

    let timer: NodeJS.Timeout;

    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `Publishing to the ${EMAIL_QUEUE} queue timed out after ${publishTimeoutMs}ms`
            )
          ),
        publishTimeoutMs
      );
    });

    return Promise.race([operation, deadline]).finally(() =>
      clearTimeout(timer)
    );
  }
}
