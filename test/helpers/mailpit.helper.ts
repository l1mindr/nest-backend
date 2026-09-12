/**
 * Reads the mailbox the application delivered to.
 *
 * Mailpit is an SMTP server that stores what it accepts and serves it back over
 * HTTP, so a spec can assert on the message a recipient would have opened
 * rather than on a fake the test itself supplied. Nothing here talks to the
 * application: the only link between the two is that both name the same SMTP
 * server, which is what makes these assertions worth anything.
 *
 * One Mailpit instance serves every Jest worker, so nothing in here reads "the
 * latest message" or clears the mailbox wholesale. Every lookup is scoped to a
 * recipient address, and specs are expected to use an address unique to the
 * test — see {@link uniqueRecipient}.
 */

import { randomUUID } from 'crypto';

const DEFAULT_BASE_URL = 'http://localhost:8025';

/** How long a delivery may take before the spec calls it a failure. */
const DEFAULT_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 100;

/** An address whose local part cannot collide with another worker's. */
export function uniqueRecipient(prefix: string): string {
  return `${prefix}-${randomUUID()}@mailpit.test`;
}

export interface MailpitAddress {
  Name: string;
  Address: string;
}

/** One row of a listing. Enough to identify a message, not to assert on it. */
export interface MailpitSummary {
  ID: string;
  MessageID: string;
  From: MailpitAddress | null;
  To: MailpitAddress[] | null;
  Subject: string;
  Created: string;
  Snippet: string;
}

/** A message in full, as delivered. */
export interface MailpitMessage {
  ID: string;
  MessageID: string;
  From: MailpitAddress | null;
  To: MailpitAddress[] | null;
  Subject: string;
  Date: string;
  Text: string;
  HTML: string;
}

interface MailpitSearchResponse {
  total: number;
  messages_count: number;
  messages: MailpitSummary[];
}

/** Only the part of Mailpit's own configuration report that matters here. */
interface MailpitWebUiConfig {
  MessageRelay?: { Enabled: boolean; SMTPServer: string };
}

export interface WaitOptions {
  /** Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
}

export class MailpitUnavailableError extends Error {
  constructor(baseUrl: string, cause: unknown) {
    super(
      `Mailpit is not reachable at ${baseUrl}. These specs deliver real SMTP and read the message back, so they need it running:\n` +
        '  docker compose -f compose/compose.dev.yml up -d mailpit\n' +
        `Cause: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    this.name = 'MailpitUnavailableError';
  }
}

export class Mailpit {
  private readonly baseUrl: string;

  constructor(baseUrl = process.env.MAILPIT_API_URL ?? DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Fails with an explanation rather than letting every assertion in the file
   * time out one after another.
   *
   * Also refuses to run against a Mailpit that can forward what it receives.
   * The specs deliver real messages to addresses nobody owns, and the only
   * thing standing between that and a stranger's inbox is that this server has
   * no upstream — so it is checked rather than assumed. Relaying is off by
   * default and turning it on takes a deliberate flag; this makes doing so
   * fail loudly instead of quietly mailing test traffic to the Internet.
   */
  async assertReachable(): Promise<void> {
    let config: MailpitWebUiConfig;

    try {
      await this.get('/api/v1/info');
      config = await this.get<MailpitWebUiConfig>('/api/v1/webui');
    } catch (error: unknown) {
      throw new MailpitUnavailableError(this.baseUrl, error);
    }

    if (config.MessageRelay?.Enabled) {
      throw new Error(
        `Mailpit at ${this.baseUrl} has message relaying enabled, so a message delivered by these specs could leave for the Internet. Remove --smtp-relay-config / --smtp-relay-all before running them.`
      );
    }
  }

  /** Every message delivered to `address`, oldest first. */
  async messagesTo(address: string): Promise<MailpitSummary[]> {
    const response = await this.get<MailpitSearchResponse>(
      `/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`
    );

    // Mailpit returns newest first; chronological order is what a spec means by
    // "the first email this flow sent".
    return [...response.messages].reverse();
  }

  async messageCount(address: string): Promise<number> {
    return (await this.messagesTo(address)).length;
  }

  /**
   * Waits for exactly `count` messages to arrive for `address` and returns them
   * in full.
   *
   * Delivery is asynchronous — the HTTP request that triggered it returned long
   * before the queue worker dialled SMTP — so waiting is the only correct way
   * to read it. The wait is on the mailbox rather than on a fixed sleep, so a
   * fast machine does not idle and a slow one does not flake.
   */
  async waitForMessages(
    address: string,
    count: number,
    options: WaitOptions = {}
  ): Promise<MailpitMessage[]> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;

    let summaries: MailpitSummary[] = [];

    while (Date.now() < deadline) {
      summaries = await this.messagesTo(address);

      if (summaries.length >= count) break;

      await delay(POLL_INTERVAL_MS);
    }

    if (summaries.length !== count) {
      throw new Error(
        `Expected ${count} message(s) for ${address} within ${timeoutMs}ms, found ${summaries.length}.`
      );
    }

    return Promise.all(summaries.map((summary) => this.message(summary.ID)));
  }

  /** The single message a flow is expected to have sent. */
  async waitForMessage(
    address: string,
    options: WaitOptions = {}
  ): Promise<MailpitMessage> {
    const [message] = await this.waitForMessages(address, 1, options);

    return message;
  }

  /**
   * Gives a flow that should send nothing the chance to prove otherwise.
   *
   * Asserting an empty mailbox immediately would pass whether or not the email
   * is on its way, so this waits out a delivery window first.
   */
  async expectNoMessages(address: string, windowMs = 2_000): Promise<void> {
    await delay(windowMs);

    const found = await this.messagesTo(address);

    if (found.length > 0) {
      throw new Error(
        `Expected no messages for ${address}, found ${found.length}.`
      );
    }
  }

  async message(id: string): Promise<MailpitMessage> {
    return this.get<MailpitMessage>(
      `/api/v1/message/${encodeURIComponent(id)}`
    );
  }

  /** The message source, headers included — what a leak check has to read. */
  async raw(id: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/message/${encodeURIComponent(id)}/raw`
    );

    if (!response.ok) {
      throw new Error(
        `Mailpit returned ${response.status} for the raw source of ${id}.`
      );
    }

    return response.text();
  }

  /**
   * Removes only what this spec put there. The mailbox is shared with every
   * other Jest worker, so the delete-all endpoint is not an option.
   */
  async deleteMessagesTo(address: string): Promise<void> {
    const summaries = await this.messagesTo(address);

    if (summaries.length === 0) return;

    const response = await fetch(`${this.baseUrl}/api/v1/messages`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IDs: summaries.map(({ ID }) => ID) })
    });

    if (!response.ok) {
      throw new Error(
        `Mailpit returned ${response.status} when deleting messages for ${address}.`
      );
    }
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);

    if (!response.ok) {
      throw new Error(`Mailpit returned ${response.status} for ${path}.`);
    }

    return (await response.json()) as T;
  }
}

export function recipientsOf(message: MailpitMessage): string[] {
  return (message.To ?? []).map(({ Address }) => Address);
}

/** `Name <address>`, or just the address — whatever `EMAIL_FROM` asked for. */
export function senderOf(message: MailpitMessage): string {
  const from = message.From;

  if (!from) return '';

  return from.Name ? `${from.Name} <${from.Address}>` : from.Address;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
