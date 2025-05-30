import type { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import { getCookie } from 'hono/cookie'
import { CONFIG } from '../config'
import { getUserById } from '../services/userService'
import type { UserContext } from '../types/auth'
import { logger } from '../utils/logger'
import { isAuthorized } from '../utils/tokenUtils'

/**
 * Middleware to authenticate requests using cookies
 * @param {Context} c - Hono context
 * @param {Next} next - Next middleware function
 * @returns {Promise<Response|void>} Response or void if authentication succeeds
 */
export const cookieAuthMiddleware = async (c: Context, next: Next) => {
	// Use getCookie instead of c.req.cookie
	const accessToken = getCookie(c, 'access_token')

	if (!accessToken) {
		logger.warn('Cookie authentication failed: No access token provided')
		return c.json(
			{
				success: false,
				error: 'Authentication required'
			},
			401
		)
	}

	try {
		const payload = await verify(accessToken, CONFIG.JWT_ACCESS_SECRET)
		const userId = payload.userId as number

		// Set userId in context
		c.set('userId', userId)

		// Get user information
		const user = await getUserById(userId)

		// Set user in context using UserContext type
		const userContext: UserContext = {
			id: user.id,
			email: user.email,
			fullName: user.fullName,
			avatarUrl: user.avatarUrl
		}
		c.set('user', userContext)

		// Check if the requested user ID matches the authenticated user's ID
		const requestedUserId = c.req.param('id')
		if (requestedUserId && !isAuthorized(c, Number(requestedUserId))) {
			logger.warn(`Unauthorized access attempt: User ${userId} tried to access data for user ${requestedUserId}`)
			return c.json(
				{
					success: false,
					error: 'Unauthorized access'
				},
				403
			)
		}

		logger.debug(`Cookie authentication successful for user: ${userId}`)
		await next()
	} catch (_error) {
		logger.warn('Cookie authentication failed: Invalid or expired access token')
		// If token has expired, try to refresh using refresh token
		const refreshToken = getCookie(c, 'refresh_token')

		if (!refreshToken) {
			return c.json(
				{
					success: false,
					error: 'Authentication required'
				},
				401
			)
		}

		// Redirect to refresh token endpoint
		return c.redirect('/auth/refresh-token')
	}
}
