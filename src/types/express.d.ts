import type {
  AuthSession,
  AuthUser,
  DeviceContext
} from '@presentation/interfaces/context';

/**
 * Augments the Express request with the properties this application attaches
 * at runtime:
 * - `user`/`session` are populated by the JWT guard after authentication.
 * - `device` is populated by the device-detection middleware.
 *
 * They are optional because they are not present on every request (e.g. public
 * routes have no authenticated `user`).
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      session?: AuthSession;
      device?: DeviceContext;
    }
  }
}

export {};
