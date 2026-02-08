/**
 * URL validation utility for SSRF protection
 *
 * Prevents server-side request forgery by blocking requests to:
 * - Private/internal IP ranges (RFC1918)
 * - Localhost and loopback addresses
 * - Link-local addresses
 * - Cloud metadata endpoints
 * - Non-HTTP(S) protocols
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Custom error for URL validation failures
 */
export class SSRFProtectionError extends Error {
  constructor(url: string, reason: string) {
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = '<invalid>';
    }
    super(`URL blocked by SSRF protection: ${reason} (hostname: ${hostname})`);
    this.name = 'SSRFProtectionError';
  }
}

/**
 * Checks if an IP address is in a private/reserved range
 */
function isPrivateIP(ip: string): boolean {
  const ipv4Parts = ip.split('.').map(Number);

  if (ipv4Parts.length === 4 && ipv4Parts.every(p => p >= 0 && p <= 255)) {
    // 10.0.0.0/8
    if (ipv4Parts[0] === 10) return true;
    // 172.16.0.0/12
    if (ipv4Parts[0] === 172 && ipv4Parts[1] >= 16 && ipv4Parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (ipv4Parts[0] === 192 && ipv4Parts[1] === 168) return true;
    // 127.0.0.0/8 (loopback)
    if (ipv4Parts[0] === 127) return true;
    // 0.0.0.0/8
    if (ipv4Parts[0] === 0) return true;
    // 169.254.0.0/16 (link-local / cloud metadata)
    if (ipv4Parts[0] === 169 && ipv4Parts[1] === 254) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (ipv4Parts[0] === 100 && ipv4Parts[1] >= 64 && ipv4Parts[1] <= 127) return true;
  }

  // IPv6 checks
  const ipLower = ip.toLowerCase();
  if (ipLower === '::1' || ipLower === '0:0:0:0:0:0:0:1') return true;
  if (ipLower === '::' || ipLower === '0:0:0:0:0:0:0:0') return true;
  if (ipLower.startsWith('fe80:')) return true;
  if (ipLower.startsWith('fc') || ipLower.startsWith('fd')) return true;
  // IPv4-mapped IPv6
  if (ipLower.startsWith('::ffff:')) {
    const embedded = ipLower.replace('::ffff:', '');
    if (embedded.includes('.')) return isPrivateIP(embedded);
  }

  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.google.com',
  'metadata',
  'instance-data',
]);

/**
 * Validates a URL for SSRF protection.
 * Throws SSRFProtectionError if the URL targets a private/internal resource.
 */
export async function validateUrlForSSRF(urlString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new SSRFProtectionError(urlString, 'Invalid URL');
  }

  // 1. Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SSRFProtectionError(urlString, `Protocol '${parsed.protocol}' is not allowed`);
  }

  // 2. Block known metadata hostnames
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new SSRFProtectionError(urlString, `Hostname '${hostname}' is blocked`);
  }

  // 3. If hostname is an IP literal, check directly
  // URL parser keeps brackets for IPv6 (e.g. "[::1]"), strip them for isIP check
  const bareHostname = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  if (isIP(bareHostname)) {
    if (isPrivateIP(bareHostname)) {
      throw new SSRFProtectionError(urlString, 'IP address is in a private/reserved range');
    }
    return;
  }

  // 4. DNS resolution — check all returned IPs
  try {
    const result = await lookup(hostname, { all: true });
    const addresses = Array.isArray(result) ? result : [result];

    for (const addr of addresses) {
      const address = typeof addr === 'string' ? addr : addr.address;
      if (isPrivateIP(address)) {
        throw new SSRFProtectionError(
          urlString,
          `Hostname '${hostname}' resolves to private IP`
        );
      }
    }
  } catch (error) {
    if (error instanceof SSRFProtectionError) throw error;
    // DNS failure — let the actual fetch fail with a network error
  }
}
