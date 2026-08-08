import {
  EmailMessage,
  EmailMessageType
} from '@infrastructure/email/email.message';
import { EmailJob } from './email.job';

/**
 * A job whose payload cannot be delivered no matter how often it is retried.
 *
 * Kept as a plain error rather than a BullMQ `UnrecoverableError` so the
 * validator stays testable without a queue; the processor is what translates it
 * into "stop retrying".
 */
export class MalformedEmailJobError extends Error {
  constructor(reason: string) {
    super(`Email job payload is malformed: ${reason}`);
    this.name = MalformedEmailJobError.name;
  }
}

/**
 * Deliberately loose. Addresses reaching the queue have already passed DTO
 * validation or come straight from a persisted row, so this is a tripwire
 * against a corrupt or hand-edited job rather than a second address validator.
 */
const ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(
  source: Record<string, unknown>,
  field: string,
  path: string
): string {
  const value = source[field];

  if (typeof value !== 'string' || value.length === 0) {
    throw new MalformedEmailJobError(
      `${path}.${field} must be a non-empty string`
    );
  }

  return value;
}

function readNullableString(
  source: Record<string, unknown>,
  field: string,
  path: string
): string | null {
  const value = source[field];

  if (value === null) return null;

  if (typeof value !== 'string') {
    throw new MalformedEmailJobError(
      `${path}.${field} must be a string or null`
    );
  }

  return value;
}

function readPositiveInteger(
  source: Record<string, unknown>,
  field: string,
  path: string
): number {
  const value = source[field];

  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new MalformedEmailJobError(
      `${path}.${field} must be a positive integer`
    );
  }

  return value;
}

function readIsoTimestamp(
  source: Record<string, unknown>,
  field: string,
  path: string
): string {
  const value = readString(source, field, path);

  if (Number.isNaN(Date.parse(value))) {
    throw new MalformedEmailJobError(
      `${path}.${field} must be an ISO 8601 timestamp`
    );
  }

  return value;
}

function readData(message: Record<string, unknown>): Record<string, unknown> {
  const { data } = message;

  if (!isRecord(data)) {
    throw new MalformedEmailJobError('message.data must be an object');
  }

  return data;
}

function parseMessage(value: unknown): EmailMessage {
  if (!isRecord(value)) {
    throw new MalformedEmailJobError('message must be an object');
  }

  const to = readString(value, 'to', 'message');

  if (!ADDRESS_PATTERN.test(to)) {
    throw new MalformedEmailJobError('message.to is not an email address');
  }

  const data = readData(value);

  switch (value.type) {
    case EmailMessageType.VERIFICATION:
      return {
        type: EmailMessageType.VERIFICATION,
        to,
        data: {
          code: readString(data, 'code', 'message.data'),
          expiresInMinutes: readPositiveInteger(
            data,
            'expiresInMinutes',
            'message.data'
          )
        }
      };

    case EmailMessageType.ADMIN_INVITATION:
      return {
        type: EmailMessageType.ADMIN_INVITATION,
        to,
        data: {
          token: readString(data, 'token', 'message.data'),
          expiresInHours: readPositiveInteger(
            data,
            'expiresInHours',
            'message.data'
          )
        }
      };

    case EmailMessageType.SUSPENSION:
      return {
        type: EmailMessageType.SUSPENSION,
        to,
        data: {
          displayName: readNullableString(data, 'displayName', 'message.data'),
          reason: readString(data, 'reason', 'message.data'),
          suspendedAt: readIsoTimestamp(data, 'suspendedAt', 'message.data')
        }
      };

    case EmailMessageType.UNSUSPENSION:
      return {
        type: EmailMessageType.UNSUSPENSION,
        to,
        data: {
          displayName: readNullableString(data, 'displayName', 'message.data'),
          unsuspendedAt: readIsoTimestamp(data, 'unsuspendedAt', 'message.data')
        }
      };

    default:
      throw new MalformedEmailJobError(
        `message.type "${String(value.type)}" is not a known email message`
      );
  }
}

/**
 * Rebuilds a trusted {@link EmailJob} from whatever Redis handed back.
 *
 * The returned value is a fresh object holding only recognised fields, so a job
 * written by an older or tampered-with producer cannot smuggle extra properties
 * through to the provider.
 *
 * @throws MalformedEmailJobError when the payload cannot be delivered as-is.
 */
export function parseEmailJob(value: unknown): EmailJob {
  if (!isRecord(value)) {
    throw new MalformedEmailJobError('job data must be an object');
  }

  return {
    message: parseMessage(value.message),
    queuedAt: readIsoTimestamp(value, 'queuedAt', 'job')
  };
}
