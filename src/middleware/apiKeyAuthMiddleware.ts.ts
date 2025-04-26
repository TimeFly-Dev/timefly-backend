import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { validateApiKey } from '../services/apiKeyService'
import { getUserById } from '../services/userService'
import type { UserContext } from '../types/auth'
import { logger } from '../utils/logger'

/**
 * Middleware to authenticate requests using API key
 * Specifically designed for the sync endpoint used by the VS Code extension
 * @param {Context} c - Hono context
 * @param {Next} next - Next middleware function
 * @returns {Promise<Response|void>} Response or void if authentication succeeds
 */
export const apiKeyAuthMiddleware = async (c: Context, next: Next) => {
	// First try to authenticate with API key
	const apiKey = c.req.header('X-API-Key')

	if (apiKey) {
		const userId = await validateApiKey(apiKey)

		if (userId) {
			const user = await getUserById(userId)

			if (user) {
				// Set user in context for downstream handlers
				c.set('userId', userId)

				// Convert to UserContext
				const userContext: UserContext = {
					id: user.id,
					email: user.email,
					fullName: user.fullName,
					avatarUrl: user.avatarUrl
				}
				c.set('user', userContext)

				logger.debug(`API Key authentication successful for user: ${userId}`)
				await next()
				return
			}
		}

		logger.warn(`Invalid API Key authentication attempt: ${apiKey.substring(0, 8)}...`)
	}

	// If no API key or invalid, try to authenticate with cookie
	const accessToken = getCookie(c, 'access_token')

	if (!accessToken) {
		logger.warn('Authentication failed: No API key or access token provided')
		return c.json(
			{
				success: false,
				error: 'Authentication required. Provide a valid API key or login.'
			},
			401
		)
	}

	// Redirect to cookie authentication middleware
	return c.redirect('/auth/me')
}
