import { Injectable } from '@nestjs/common';

/**
 * Password hashing boundary.
 *
 * Application code depends on this abstraction only; the concrete algorithm
 * (Argon2id, with legacy bcrypt verification) lives in infrastructure.
 *
 * `needsMigration` lets the login flow detect a legacy hash and upgrade it
 * without the use case knowing anything about hash formats.
 */
@Injectable()
export abstract class HashingProvider {
  abstract hash(data: string | Buffer): Promise<string>;
  abstract compare(data: string | Buffer, encrypted: string): Promise<boolean>;
  abstract needsMigration(encrypted: string): boolean;
}
