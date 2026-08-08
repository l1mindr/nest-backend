/**
 * Decides whether a failed delivery is worth attempting again.
 *
 * The distinction matters in both directions: retrying a mailbox that does not
 * exist wastes the queue and looks like an outage, while giving up on a
 * momentary connection reset loses an email the recipient is waiting for.
 *
 * SMTP already draws this line — 4xx means "try later", 5xx means "never" — so
 * the reply code decides whenever nodemailer reports one, and the transport
 * error code is only consulted for failures that never reached a reply.
 */

const PERMANENT_TRANSPORT_CODES = new Set([
  // Rejected envelope with no usable reply code: a malformed or refused
  // address. Re-sending the identical envelope cannot change the answer.
  'EENVELOPE',
  // The message itself was refused, e.g. it exceeds the server's size limit.
  'EMESSAGE',
  // Credentials were rejected. Retrying hammers an account that is already
  // failing to authenticate; this needs a configuration fix, not a backoff.
  'EAUTH'
]);

function readCode(
  error: Record<string, unknown>,
  field: string
): string | null {
  const value = error[field];

  return typeof value === 'string' ? value : null;
}

/**
 * @returns true when further attempts cannot succeed.
 */
export function isPermanentDeliveryFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const candidate = error as Record<string, unknown>;
  const responseCode = candidate.responseCode;

  // A reply from the server is the most reliable signal available, so it wins
  // over the transport code — `EENVELOPE` accompanies a 4xx greylisting reply
  // just as readily as a 5xx rejection.
  if (typeof responseCode === 'number') {
    return responseCode >= 500 && responseCode < 600;
  }

  const code = readCode(candidate, 'code') ?? readCode(candidate, 'name');

  return code !== null && PERMANENT_TRANSPORT_CODES.has(code);
}
