import { EmailPublisher } from '@infrastructure/email/email.publisher';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { EMAIL_QUEUE } from '../queue.constants';
import { BullEmailPublisher } from './bull-email.publisher';
import { EmailProcessor } from './email.processor';

/**
 * The email queue, its producer and its consumer.
 *
 * Global for the same reason `EmailModule` is: sending email is something any
 * feature may need, and threading an import through every module that happens
 * to notify a user adds nothing.
 *
 * Producer and consumer are registered together, so one process both serves
 * requests and delivers email. Splitting them — an API deployment that only
 * publishes, worker deployments that only consume — means giving this module a
 * flag and adding a worker entry point; nothing in the design here prevents it.
 */
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [
    BullEmailPublisher,
    { provide: EmailPublisher, useExisting: BullEmailPublisher },
    EmailProcessor
  ],
  exports: [EmailPublisher]
})
export class EmailQueueModule {}
