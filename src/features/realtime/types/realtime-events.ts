import { AlertDirection } from '@features/coin-tracker/domain/enums/alert-direction.enum';

/**
 * Realtime event contract shared conceptually with the frontend's
 * `RealtimeEventMap` (next-dashboard-frontend/src/lib/realtime/events.ts).
 * The two are not imported across repos, so keep them in sync by hand.
 *
 * Payloads carry identifiers/metadata, not full entities: the frontend
 * refetches authoritative data through the existing REST + TanStack Query
 * path rather than trusting a duplicated snapshot pushed over the socket.
 */

export interface TransactionCreatedEvent {
  type: 'transaction.created';
  payload: { portfolioId: string; transactionId: string };
}

export interface TransactionUpdatedEvent {
  type: 'transaction.updated';
  payload: { portfolioId: string; transactionId: string };
}

export interface TransactionDeletedEvent {
  type: 'transaction.deleted';
  payload: { portfolioId: string; transactionId: string };
}

export interface PriceAlertTriggeredEvent {
  type: 'price-alert.triggered';
  payload: {
    alertId: string;
    coinId: string;
    direction: AlertDirection;
    targetPrice: string;
    currentPrice: string;
  };
}

export type RealtimeEvent =
  | TransactionCreatedEvent
  | TransactionUpdatedEvent
  | TransactionDeletedEvent
  | PriceAlertTriggeredEvent;

export type RealtimeEventType = RealtimeEvent['type'];
