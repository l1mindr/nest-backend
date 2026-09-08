import {
  ValidatorConstraint,
  ValidatorConstraintInterface
} from 'class-validator';
import {
  NotificationChannel,
  SUPPORTED_NOTIFICATION_CHANNELS,
  isSupportedNotificationChannel
} from '../../domain/enums/notification-channel.enum';

/**
 * Rejects notification channels the application cannot actually deliver on.
 *
 * `@IsEnum(NotificationChannel, { each: true })` only proves a value is a member
 * of the enum — and `SMS` is a member with no transport behind it (see
 * `SUPPORTED_NOTIFICATION_CHANNELS`). Without this constraint the API accepts an
 * SMS-only alert, reports 201, fires it on schedule, marks it triggered, and
 * delivers nothing.
 *
 * Applied per element (`{ each: true }`), so a rejection produces the standard
 * 422 `VALIDATION` envelope with `meta.field = "notificationChannels"` — the
 * same shape every other validation failure uses, which the frontend now
 * renders through `lib/api/error-contract`.
 */
@ValidatorConstraint({ name: 'IsSupportedNotificationChannel', async: false })
export class SupportedNotificationChannelValidator implements ValidatorConstraintInterface {
  validate(value: NotificationChannel): boolean {
    return isSupportedNotificationChannel(value);
  }

  defaultMessage(): string {
    return `notificationChannels must contain only supported channels: ${SUPPORTED_NOTIFICATION_CHANNELS.join(
      ', '
    )}`;
  }
}
