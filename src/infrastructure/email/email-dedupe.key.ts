import { EmailMessageType } from './email.message';

/**
 * Builds the key that identifies one email *occasion*.
 *
 * Publishing the same key twice sends one email, so the parts must name the
 * event rather than describe it: the row that records the issued code, the
 * invitation being delivered, the instant an account changed state. Two of
 * those come with a database identity already, which is the strongest key
 * available — one email per persisted fact.
 *
 * Never build a key from a verification code, an invitation token or any other
 * secret. Keys become Redis key names and appear in queue dashboards, so a
 * secret used here is a secret published.
 *
 * The message type prefixes every key because job ids share one namespace per
 * queue, and `.` separates the parts because BullMQ reserves `:` in custom job
 * ids.
 */
export function emailDedupeKey(
  type: EmailMessageType,
  ...parts: readonly (string | number)[]
): string {
  return [type, ...parts].join('.');
}
