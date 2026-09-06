import { RealtimeEvent } from '../../types/realtime-events';

export const REALTIME_EVENT_PUBLISHER = Symbol('REALTIME_EVENT_PUBLISHER');

/**
 * Fan-out boundary between domain use-cases and the WebSocket transport.
 * Use-cases depend on this interface, never on the gateway/socket.io
 * directly, so business logic stays transport-agnostic (see Phase 4 rule 16).
 */
export interface IRealtimeEventPublisher {
  /** Emits a domain event to every socket the user currently has open. */
  publishToUser(userId: string, event: RealtimeEvent): void;

  /** Force-disconnects only the sockets belonging to one session (device). */
  disconnectSession(sessionId: string): void;

  /** Force-disconnects every socket belonging to the user (logout everywhere). */
  disconnectUser(userId: string): void;

  /** Force-disconnects every socket of the user except the given session. */
  disconnectUserExcept(userId: string, exceptSessionId: string): void;
}
