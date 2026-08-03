/** Returned when the address is absent or cannot be parsed. */
export const UNKNOWN_SUBNET = 'unknown';

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV4_MAPPED_PREFIX = '::ffff:';

/** Network bits kept per family: enough to survive a client's dynamic address. */
const IPV4_KEPT_OCTETS = 3; // /24
const IPV6_KEPT_HEXTETS = 4; // /64

function isIpv4(value: string): boolean {
  const match = IPV4_PATTERN.exec(value);

  if (!match) return false;

  return match.slice(1).every((octet) => Number(octet) <= 255);
}

/**
 * Truncates an address to its network portion so a device identifier survives a
 * client hopping addresses inside its own network, while still changing when
 * the client moves to a genuinely different network.
 *
 * IPv4 keeps the /24, IPv6 the /64 — the smallest block normally assigned to a
 * single subscriber. IPv4-mapped IPv6 (`::ffff:a.b.c.d`, what Express reports
 * on a dual-stack socket) is unwrapped first so the same client yields the same
 * subnet on either stack.
 */
export function toSubnet(ip?: string): string {
  if (!ip) return UNKNOWN_SUBNET;

  const address = ip.trim().toLowerCase();

  if (address.length === 0) return UNKNOWN_SUBNET;

  const unwrapped = address.startsWith(IPV4_MAPPED_PREFIX)
    ? address.slice(IPV4_MAPPED_PREFIX.length)
    : address;

  if (isIpv4(unwrapped)) {
    return unwrapped.split('.').slice(0, IPV4_KEPT_OCTETS).join('.');
  }

  if (unwrapped.includes(':')) {
    // `::` compresses a run of zero hextets. Expanding it keeps the /64 aligned
    // to real hextet boundaries instead of whatever the compressed text implies.
    const expanded = expandIpv6(unwrapped);

    if (!expanded) return UNKNOWN_SUBNET;

    return expanded.slice(0, IPV6_KEPT_HEXTETS).join(':');
  }

  return UNKNOWN_SUBNET;
}

const IPV6_HEXTETS = 8;
const HEXTET_PATTERN = /^[0-9a-f]{1,4}$/;

function expandIpv6(address: string): string[] | null {
  const halves = address.split('::');

  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

  if (![...head, ...tail].every((hextet) => HEXTET_PATTERN.test(hextet))) {
    return null;
  }

  if (halves.length === 1) {
    return head.length === IPV6_HEXTETS ? head : null;
  }

  const missing = IPV6_HEXTETS - head.length - tail.length;

  if (missing < 0) return null;

  return [...head, ...Array<string>(missing).fill('0'), ...tail];
}
