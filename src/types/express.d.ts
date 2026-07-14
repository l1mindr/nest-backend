import { DeviceContext } from '@features/security/device-detection/context/device-context.interface';
import { Session } from '@features/sessions/entities/session.entity';
import { User } from '@features/users/entities/user.entity';

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
      user?: User;
      session?: Session;
      device?: DeviceContext;
    }
  }
}

export {};
