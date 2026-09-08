export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS'
}

/**
 * Channels a price alert may actually be created or updated with.
 *
 * `SMS` stays in the enum but is **not** deliverable: no SMS provider is
 * configured anywhere in this project, and `EmailNotificationService.sendSms`
 * records the request and drops it. Previously a caller could select SMS, the
 * alert would fire, `markTriggered` would run, and nothing would ever arrive —
 * a silent no-op the user had no way to detect.
 *
 * The enum member cannot simply be deleted: `notificationChannels` is a
 * PostgreSQL enum array column (`notification_channel_enum`), so removing the
 * value would need a migration and would break alerts already storing it.
 * Instead the write path rejects it (`@IsSupportedNotificationChannel`), which
 * closes the gap for every new and edited alert while leaving stored rows
 * readable. Existing SMS-carrying alerts keep working exactly as before: their
 * EMAIL channel still delivers, and the SMS one is still logged and dropped.
 *
 * Adding a real SMS transport is a two-line change here plus the provider —
 * this list, and the frontend's `SUPPORTED_NOTIFICATION_CHANNELS` mirror in
 * `next-dashboard-frontend/src/features/price-alerts/types.ts`.
 */
export const SUPPORTED_NOTIFICATION_CHANNELS: readonly NotificationChannel[] = [
  NotificationChannel.EMAIL
];

export function isSupportedNotificationChannel(
  channel: NotificationChannel
): boolean {
  return SUPPORTED_NOTIFICATION_CHANNELS.includes(channel);
}
