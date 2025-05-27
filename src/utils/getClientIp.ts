import type { Context } from 'hono'

/**
 * Gets the real client IP address from request headers.
 * Supports proxies and multiple IPs in x-forwarded-for.
 */
export function getClientIp(c: Context): string {
  const xForwardedFor = c.req.header('x-forwarded-for')
  if (xForwardedFor) {
    // Can be a list of IPs, take the first (the real one)
    return xForwardedFor.split(',')[0].trim()
  }
  return (
    c.req.header('x-real-ip') ||
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-client-ip') ||
    c.req.header('fastly-client-ip') ||
    c.req.header('true-client-ip') ||
    c.req.header('x-cluster-client-ip') ||
    c.req.header('x-forwarded') ||
    c.req.header('forwarded-for') ||
    c.req.header('forwarded') ||
    c.req.header('remote-addr') ||
    'unknown'
  )
} 