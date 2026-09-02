import {
  ITokenValidationService,
  ITokenVerificationService,
  TOKEN_VALIDATION_SERVICE,
  TOKEN_VERIFICATION_SERVICE
} from '@features/token/interfaces/token.interface';
import { LogEvent } from '@infrastructure/logging/logging.constants';
import { Inject } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { PinoLogger } from 'nestjs-pino';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from '../application/services/realtime.service';
import { parseCookieHeader } from '../infrastructure/utils/parse-cookie-header.util';
import { sessionRoom, userRoom } from '../realtime.constants';

/**
 * Single realtime transport for the app (Phase 4). No `@SubscribeMessage`
 * handlers are exposed: clients never declare which user/portfolio they are,
 * they are only ever placed into rooms the server derives from their own
 * authenticated session (`handleConnection`). This is the server-controlled
 * subscription model required by Phase 4 rule 14 — there is nothing here
 * equivalent to a client-supplied `joinPortfolio({ portfolioId })`.
 */
@WebSocketGateway()
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly realtimeService: RealtimeService,
    @Inject(TOKEN_VERIFICATION_SERVICE)
    private readonly verificationService: ITokenVerificationService,
    @Inject(TOKEN_VALIDATION_SERVICE)
    private readonly validationService: ITokenValidationService,
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(RealtimeGateway.name);
  }

  afterInit(server: Server): void {
    this.realtimeService.attachServer(server);
  }

  /**
   * Authenticates the handshake against the same `access_token` cookie and
   * verification/validation services the HTTP `JwtGuard` uses (see
   * `JwtStrategy.authenticate`), so a WebSocket connection can never be
   * established under an identity the REST API would have rejected. The
   * resolved user/session — never anything the client claims — decides which
   * rooms the socket joins.
   */
  async handleConnection(socket: Socket): Promise<void> {
    try {
      const cookies = parseCookieHeader(socket.handshake.headers.cookie);
      const token = cookies.access_token;

      if (!token) {
        throw new Error('missing access_token cookie');
      }

      const payload = await this.verificationService.verifyAccess(token);
      const { user, session } = await this.validationService.validate(payload);

      socket.data.userId = user.id;
      socket.data.sessionId = session.id;

      await socket.join(userRoom(user.id));
      await socket.join(sessionRoom(session.id));

      this.logger.info(
        { event: LogEvent.REALTIME_WS_CONNECTED, userId: user.id },
        'WebSocket connected'
      );
    } catch {
      // Never surface why: an invalid/expired/missing token all look the
      // same to the client, matching the HTTP 401 behavior for bad auth.
      this.logger.warn(
        { event: LogEvent.REALTIME_WS_AUTH_REJECTED },
        'WebSocket authentication rejected'
      );
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const userId = socket.data.userId as string | undefined;

    if (!userId) return;

    this.logger.info(
      { event: LogEvent.REALTIME_WS_DISCONNECTED, userId },
      'WebSocket disconnected'
    );
  }
}
