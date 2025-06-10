import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { getClientIp } from '@/utils/getClientIp'
import type { Context } from 'hono'

// Configurable rate limit values
const RATE_LIMIT = 100
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

// In-memory store for demonstration (replace with Redis/DB for production)
const rateLimitStore: Record<string, { count: number, reset: number }> = {}

function getIdentifier(c: Context): string {
  // 1. Try IP
  const ip = getClientIp(c)
  if (ip && ip !== 'unknown') { return `ip:${ip}` }

  // 2. Try JWT token
  const authHeader = c.req.header('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    return `jwt:${token}`
  }

  // 3. Try API key
  const apiKey = c.req.header('x-api-key') || c.req.query('api_key')
  if (apiKey) { return `apikey:${apiKey}` }

  // 4. Fallback
  return 'unknown'
}

const rateLimitRoute = new Hono()

rateLimitRoute.get(
  '/',
  describeRoute({
    description: 'Get API rate limit status for current client (by IP, token, or API key).',
    tags: ['Rate Limit'],
    responses: {
      200: {
        description: 'Rate limit status',
        content: {
          'application/json': {
            example: {
              limit: 100,
              remaining: 87,
              reset: 1717958400,
              identifier: 'ip:1.2.3.4'
            }
          }
        }
      }
    }
  }),
  async (c) => {
    const identifier = getIdentifier(c)
    const now = Date.now()
    let entry = rateLimitStore[identifier]

    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + WINDOW_MS }
      rateLimitStore[identifier] = entry
    }

    return c.json({
      limit: RATE_LIMIT,
      remaining: Math.max(0, RATE_LIMIT - entry.count),
      reset: Math.floor(entry.reset / 1000), // epoch seconds
      identifier
    })
  }
)

export default rateLimitRoute
