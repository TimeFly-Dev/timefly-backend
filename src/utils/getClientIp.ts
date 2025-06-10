import type { Context } from 'hono'

/**
 * Gets the real client IP address from request headers.
 * Supports proxies and multiple IPs in x-forwarded-for.
 */
export function getClientIp(c: Context): string {
  // 1. Cloudflare's CF-Connecting-IP header (most reliable when behind Cloudflare)
  // This header is guaranteed by Cloudflare to be the original client IP.
  const cfConnectingIp = c.req.header('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // 2. Standard X-Forwarded-For header
  // This can be a list of IPs: client, proxy1, proxy2, ...
  // The first IP is generally the original client.
  const xForwardedFor = c.req.header('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  // 3. Other common proxy headers.
  // 'True-Client-IP' can also be set by Cloudflare.
  // 'X-Real-IP' is often used by reverse proxies like Nginx.
  return (
    c.req.header('true-client-ip') || // Cloudflare might also use this
    c.req.header('x-real-ip') ||
    c.req.header('x-client-ip') ||
    c.req.header('fastly-client-ip') ||
    c.req.header('x-cluster-client-ip') ||
    c.req.header('x-forwarded') ||
    c.req.header('forwarded-for') ||
    c.req.header('forwarded') ||
    c.req.header('remote-addr') || // Last resort, likely IP of the immediate upstream (e.g., Cloudflare)
    'unknown'
  );
}