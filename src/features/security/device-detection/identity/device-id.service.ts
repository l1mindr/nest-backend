import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SecurityHasher } from '../../hashing/security-hasher.service';
import { toSubnet } from '../utils/ip-subnet.util';
import { DeviceIdentity } from './device-identity.interface';

export const DEVICE_ID_HEADER = 'x-device-id';

/**
 * Opaque handle a client may send to identify itself. Bounded and restricted to
 * URL-safe characters so a hostile value cannot smuggle structure into a Redis
 * key or a log line.
 */
const CLIENT_DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

const MAX_ACCEPT_LANGUAGE_LENGTH = 100;

@Injectable()
export class DeviceIdService {
  constructor(private readonly hasher: SecurityHasher) {}

  /**
   * Resolves a stable per-device handle.
   *
   * A client-supplied `X-Device-Id` wins when it is well formed, because it
   * survives address changes that the derived value cannot. It is not trusted:
   * a caller that rotates the header simply lands in a fresh bucket, which is
   * why the derived identifier is always computed alongside it and every policy
   * group also carries a dimension the client cannot influence.
   */
  resolve(request: Request, normalizedUa: string): DeviceIdentity {
    const derivedDeviceId = this.derive(request, normalizedUa);
    const supplied = this.readHeader(request);

    return supplied
      ? { deviceId: supplied, derivedDeviceId, deviceIdSource: 'header' }
      : {
          deviceId: derivedDeviceId,
          derivedDeviceId,
          deviceIdSource: 'derived'
        };
  }

  private readHeader(request: Request): string | null {
    const raw = request.headers[DEVICE_ID_HEADER];

    // Express collapses a repeated header into an array; reject rather than
    // guess which occurrence the client meant.
    if (typeof raw !== 'string') return null;

    const value = raw.trim();

    if (!CLIENT_DEVICE_ID_PATTERN.test(value)) return null;

    // Hashed despite being client-supplied: it bounds the key length and keeps
    // an attacker-chosen string out of Redis key space and out of the logs.
    return this.hasher.hmacHex(`device:header:${value}`);
  }

  private derive(request: Request, normalizedUa: string): string {
    const language = this.readAcceptLanguage(request);
    const subnet = toSubnet(request.ip);

    return this.hasher.hmacHex(
      `device:derived:${normalizedUa}|${language}|${subnet}`
    );
  }

  private readAcceptLanguage(request: Request): string {
    const raw = request.headers['accept-language'];

    if (typeof raw !== 'string') return '';

    return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_ACCEPT_LANGUAGE_LENGTH);
  }
}
