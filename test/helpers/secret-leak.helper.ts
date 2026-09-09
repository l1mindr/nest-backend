/**
 * Checks that a piece of text does not contain a secret, and reports the answer
 * without ever repeating the secret back.
 *
 * The point of the exercise is defeated by an assertion whose failure output
 * prints the value it was looking for: Jest failure messages end up in CI logs,
 * and a diff reading "expected <app password> not to be present" publishes the
 * app password to everyone who can read the build. So every function here
 * returns and throws *names* — the environment variable, or the label the
 * caller gave it — and no value ever leaves this file.
 */

/**
 * Configuration whose values must never appear in a delivered message, a log
 * line, or a test's output.
 */
const SECRET_ENV_VARS = [
  'EMAIL_APP_PASSWORD',
  'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET',
  'CSRF_TOKEN_SECRET',
  'SECURITY_HASH_SECRET',
  'DATA_SOURCE_PASSWORD',
  'REDIS_PASSWORD',
  'OWNER_PASSWORD'
] as const;

/**
 * Values short enough that finding one proves nothing: `postgres` is a word
 * that could appear in prose, whereas a token secret is not. Applies only to
 * values read from the environment — a caller naming a specific secret to look
 * for is always taken at their word.
 */
const MIN_ENV_SECRET_LENGTH = 8;

export interface NamedSecret {
  /** Safe to print. */
  name: string;
  /** Never printed. */
  value: string;
  /**
   * How to look for it, when a plain substring search would be wrong.
   *
   * A six-digit verification code occurs by chance inside a millisecond
   * timestamp, so searching for one as a substring reports leaks that are not
   * there. See {@link digitSecret}.
   */
  pattern?: RegExp;
}

/**
 * A short, all-digit secret, matched only where it stands on its own rather
 * than as a run of digits inside a longer number.
 */
export function digitSecret(name: string, value: string): NamedSecret {
  return {
    name,
    value,
    pattern: new RegExp(`(?<!\\d)${value}(?!\\d)`)
  };
}

/** The secrets this process was configured with, whichever are set. */
export function configuredSecrets(): NamedSecret[] {
  return SECRET_ENV_VARS.flatMap((name) => {
    const value = process.env[name];

    return value && value.length >= MIN_ENV_SECRET_LENGTH
      ? [{ name, value }]
      : [];
  });
}

/**
 * @returns the names of the secrets found in `haystack`, and nothing else.
 */
export function findLeakedSecrets(
  haystack: string,
  extra: NamedSecret[] = []
): string[] {
  return [...configuredSecrets(), ...extra]
    .filter(({ value, pattern }) =>
      pattern ? pattern.test(haystack) : haystack.includes(value)
    )
    .map(({ name }) => name);
}

/**
 * Asserts that none of the configured secrets, nor any of `extra`, appear in
 * `haystack`.
 *
 * @param what names the thing being scanned, so a failure says where the leak
 *   is as well as what leaked.
 */
export function expectNoSecrets(
  haystack: string,
  what: string,
  extra: NamedSecret[] = []
): void {
  const leaked = findLeakedSecrets(haystack, extra);

  expect({ scanned: what, leaked }).toEqual({ scanned: what, leaked: [] });
}
