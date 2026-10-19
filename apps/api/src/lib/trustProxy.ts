/** Cloudflare's published IPv4 ranges (https://www.cloudflare.com/ips-v4). */
export const CLOUDFLARE_IPV4_RANGES: string[] = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];

/** Cloudflare's published IPv6 ranges (https://www.cloudflare.com/ips-v6). */
export const CLOUDFLARE_IPV6_RANGES: string[] = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

/**
 * Subnets trusted to set forwarded headers. Verified production chain on
 * sss-prod-01: client -> Cloudflare -> Traefik (Docker network 172.18.0.2)
 * -> memoryconnect-api. Traefik is configured with forwardedHeaders
 * trustedIPs = Cloudflare's ranges, so it preserves Cloudflare's
 * X-Forwarded-For (the real client IP) and appends its own Cloudflare peer
 * IP to the chain. Both the Docker overlay range and Cloudflare's ranges
 * must therefore be trusted for `req.ip` to resolve to the real client.
 * Subnet-based rather than a hop count so the config stays correct if the
 * chain depth changes. Keep the Cloudflare ranges in sync with
 * https://www.cloudflare.com/ips-*.
 */
export const trustProxy: string[] = [
  'loopback',
  'linklocal',
  'uniquelocal',
  '172.16.0.0/12',
  ...CLOUDFLARE_IPV4_RANGES,
  ...CLOUDFLARE_IPV6_RANGES,
];
