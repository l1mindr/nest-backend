/**
 * An SMTP server whose replies the test chooses.
 *
 * Retry and backoff are the queue's response to what a mail server says, so
 * testing them means controlling the server rather than the client: a real
 * socket, a real SMTP conversation, a real nodemailer error carrying a real
 * `responseCode` — and a reply code the spec picked. Nothing about the
 * application is stubbed. `EmailProcessor`, `SmtpEmailService`, the transport
 * factory and BullMQ are all the production ones.
 *
 * Simulating the failure by unplugging something real would not do: a refused
 * port, a killed container or a network partition each produce a different
 * error at a different layer, none of them on demand, and a spec built on one
 * fails for reasons that have nothing to do with the code under test.
 *
 * This speaks only as much of RFC 5321 as nodemailer needs to send one message.
 * It is not a mail server and must never be used as one.
 */

import { AddressInfo, Server, Socket, createServer } from 'net';
import { Transporter } from 'nodemailer';
import { createSmtpTransport } from '@infrastructure/email/smtp-transport.provider';

const CRLF = '\r\n';
const DATA_TERMINATOR = `${CRLF}.${CRLF}`;

export interface SmtpStubOptions {
  /**
   * The reply to each successive message submission, in order. The last one is
   * repeated once the list runs out, so `['451 ...', '250 ...']` fails the
   * first attempt and accepts every attempt after it.
   */
  replies: string[];
}

interface SessionState {
  mode: 'command' | 'data' | 'auth-username' | 'auth-password';
  buffer: string;
}

export class SmtpStubServer {
  private readonly sockets = new Set<Socket>();

  private replies: string[];

  private constructor(
    private readonly server: Server,
    replies: string[],
    readonly port: number
  ) {
    this.replies = replies;
  }

  /** How many complete messages the server has been offered. */
  submissions = 0;

  /**
   * Replaces the script and forgets what came before, so one server can serve
   * several tests without each needing its own port.
   */
  script(replies: string[]): void {
    if (replies.length === 0) {
      throw new Error('An SMTP stub needs at least one scripted reply.');
    }

    this.replies = replies;
    this.submissions = 0;
  }

  static async start(options: SmtpStubOptions): Promise<SmtpStubServer> {
    if (options.replies.length === 0) {
      throw new Error('An SMTP stub needs at least one scripted reply.');
    }

    const server = createServer();

    // Loopback only. This server accepts mail and answers whatever it was told
    // to; it must not be reachable from anywhere but this process.
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve();
      });
    });

    const { port } = server.address() as AddressInfo;
    const stub = new SmtpStubServer(server, options.replies, port);

    server.on('connection', (socket) => stub.handle(socket));

    return stub;
  }

  /**
   * A transport built by the application's own factory, pointed here.
   *
   * Reusing `createSmtpTransport` rather than calling `nodemailer.createTransport`
   * directly is the point: pooling, the three timeouts and the authentication
   * are whatever production configures, so a change to any of them is felt by
   * this spec.
   */
  transport(): Transporter {
    return createSmtpTransport({
      appName: 'SMTP Stub',
      host: '127.0.0.1',
      port: this.port,
      secure: false,
      user: 'stub@mailpit.test',
      appPassword: 'stub-transport-password',
      from: 'SMTP Stub <stub@mailpit.test>'
    });
  }

  async stop(): Promise<void> {
    this.sockets.forEach((socket) => socket.destroy());
    this.sockets.clear();

    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private handle(socket: Socket): void {
    this.sockets.add(socket);
    socket.on('close', () => this.sockets.delete(socket));
    // A destroyed socket on the client's side surfaces here as ECONNRESET;
    // there is nothing to do about it and an unhandled 'error' would crash the
    // worker.
    socket.on('error', () => undefined);

    const state: SessionState = { mode: 'command', buffer: '' };

    socket.write(`220 smtp-stub.test ESMTP ready${CRLF}`);

    socket.on('data', (chunk) => {
      state.buffer += chunk.toString('utf8');

      if (state.mode === 'data') {
        this.consumeData(socket, state);
        return;
      }

      this.consumeCommands(socket, state);
    });
  }

  private consumeData(socket: Socket, state: SessionState): void {
    const end = state.buffer.indexOf(DATA_TERMINATOR);

    if (end === -1) return;

    state.buffer = state.buffer.slice(end + DATA_TERMINATOR.length);
    state.mode = 'command';

    const reply =
      this.replies[Math.min(this.submissions, this.replies.length - 1)];

    this.submissions += 1;

    socket.write(`${reply}${CRLF}`);

    // Anything pipelined behind the message body still has to be answered.
    this.consumeCommands(socket, state);
  }

  private consumeCommands(socket: Socket, state: SessionState): void {
    let newline = state.buffer.indexOf(CRLF);

    while (newline !== -1) {
      const line = state.buffer.slice(0, newline);
      state.buffer = state.buffer.slice(newline + CRLF.length);

      this.respond(socket, state, line);

      if (state.mode === 'data') {
        this.consumeData(socket, state);
        return;
      }

      newline = state.buffer.indexOf(CRLF);
    }
  }

  private respond(socket: Socket, state: SessionState, line: string): void {
    if (state.mode === 'auth-username') {
      state.mode = 'auth-password';
      socket.write(`334 UGFzc3dvcmQ6${CRLF}`);
      return;
    }

    if (state.mode === 'auth-password') {
      state.mode = 'command';
      socket.write(`235 2.7.0 Authentication successful${CRLF}`);
      return;
    }

    const command = line.split(' ')[0].toUpperCase();

    switch (command) {
      case 'EHLO':
        // No STARTTLS is advertised, which is what keeps the conversation in
        // plaintext — the same shape as the Mailpit connection.
        socket.write(
          [
            '250-smtp-stub.test',
            '250-SIZE 10485760',
            '250-8BITMIME',
            '250-AUTH PLAIN LOGIN',
            `250 HELP${CRLF}`
          ].join(CRLF)
        );
        return;

      case 'HELO':
        socket.write(`250 smtp-stub.test${CRLF}`);
        return;

      case 'AUTH':
        // `AUTH LOGIN` with no initial response starts a challenge exchange;
        // `AUTH PLAIN <credentials>` is complete in one line.
        if (/^AUTH\s+LOGIN\s*$/i.test(line)) {
          state.mode = 'auth-username';
          socket.write(`334 VXNlcm5hbWU6${CRLF}`);
          return;
        }

        socket.write(`235 2.7.0 Authentication successful${CRLF}`);
        return;

      case 'MAIL':
        socket.write(`250 2.1.0 Sender ok${CRLF}`);
        return;

      case 'RCPT':
        socket.write(`250 2.1.5 Recipient ok${CRLF}`);
        return;

      case 'DATA':
        state.mode = 'data';
        socket.write(`354 End data with <CR><LF>.<CR><LF>${CRLF}`);
        return;

      case 'RSET':
      case 'NOOP':
        socket.write(`250 2.0.0 Ok${CRLF}`);
        return;

      case 'QUIT':
        socket.write(`221 2.0.0 Bye${CRLF}`);
        socket.end();
        return;

      default:
        socket.write(`502 5.5.1 Command not implemented${CRLF}`);
    }
  }
}
