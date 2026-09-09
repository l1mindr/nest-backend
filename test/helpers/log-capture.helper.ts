/**
 * Records everything the application asks its logger to write.
 *
 * A verification code and an invitation token are the whole credential, so
 * neither may appear in a log line — an operator reading logs, or a log
 * shipper's index, must not be a way to take over an account. That rule is only
 * worth having if something checks it, which is what this is for.
 *
 * It captures at the logger rather than at stdout deliberately. Outside
 * production pino writes through a `pino-pretty` transport, which runs in a
 * worker thread and writes to the file descriptor directly — a `process.stdout`
 * patch never sees it, and a spec built on one would pass by capturing nothing
 * at all. What the application *passes* to the logger is also the thing the
 * application is responsible for; whether a given level is enabled is
 * configuration, and a code that reached the logger at all is a leak waiting
 * for someone to set `LOG_LEVEL=debug`.
 */

import { PinoLogger } from 'nestjs-pino';

const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

type Level = (typeof LEVELS)[number];

export interface LogCapture {
  /** Everything logged since capture began, as one searchable string. */
  text(): string;
  /**
   * The arguments of every log call, for assertions about a specific line —
   * that a failure was reported with `permanent: false`, say, rather than that
   * the word appears somewhere.
   */
  calls(): unknown[][];
  /** How many log calls were seen. Zero means the assertion proved nothing. */
  count(): number;
  /** Restores the real logger methods. */
  stop(): void;
}

/**
 * The structured context object a pino call carries, when it has one.
 *
 * `logger.info({ event, jobId }, 'message')` is the shape used throughout the
 * project; this picks the first argument out when it is that object.
 */
export function logContext(call: unknown[]): Record<string, unknown> | null {
  const [first] = call;

  return typeof first === 'object' && first !== null && !Array.isArray(first)
    ? (first as Record<string, unknown>)
    : null;
}

/**
 * Starts capturing. Call it before the application is created, so no line from
 * the flow under test is missed, and `stop()` in an `afterAll`.
 *
 * Logging still happens: `jest.spyOn` leaves the original implementation in
 * place, so behaviour is unchanged and a failing run still shows its logs.
 */
export function captureApplicationLogs(): LogCapture {
  const spies = LEVELS.map((level: Level) =>
    jest.spyOn(PinoLogger.prototype, level)
  );

  const calls = (): unknown[][] =>
    spies.flatMap((spy) => spy.mock.calls as unknown[][]);

  return {
    text: () => calls().map(serialize).join('\n'),
    calls,
    count: () => calls().length,
    stop: () => spies.forEach((spy) => spy.mockRestore())
  };
}

/**
 * `JSON.stringify` drops what it cannot represent, and a leak hiding in a
 * `Map`, a symbol-keyed property or a circular structure would then pass the
 * check unseen. This walks everything instead and collects every scalar it
 * finds, so the search runs over the values themselves rather than over a lossy
 * rendering of them.
 */
function serialize(args: readonly unknown[]): string {
  const parts: string[] = [];
  const seen = new WeakSet<object>();

  const visit = (value: unknown): void => {
    if (value === null || value === undefined) return;

    if (typeof value === 'string') {
      parts.push(value);
      return;
    }

    if (typeof value !== 'object') {
      parts.push(String(value));
      return;
    }

    if (seen.has(value)) return;
    seen.add(value);

    if (value instanceof Error) {
      parts.push(value.message, value.stack ?? '');
      Object.values(value).forEach(visit);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (value instanceof Map) {
      value.forEach((entry, key) => {
        visit(key);
        visit(entry);
      });
      return;
    }

    if (value instanceof Set) {
      value.forEach(visit);
      return;
    }

    Reflect.ownKeys(value).forEach((key) => {
      parts.push(String(key));
      visit((value as Record<PropertyKey, unknown>)[key]);
    });
  };

  args.forEach(visit);

  return parts.join(' ');
}
