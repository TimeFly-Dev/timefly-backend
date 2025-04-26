import type { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import { CONFIG } from '../config'
import { getUserById } from '../services/userService'
import type { UserContext } from '../types/auth'
import { logger } from '../utils/logger'

/**
 * Middleware to authenticate requests using JWT Bearer tokens
 * @param {Context} c - Hono context
 * @param {Next} next - Next middleware function
 * @returns {Promise<Response|void>} Response or void if authentication succeeds
 */
export const jwtAuthMiddleware = async (c: Context, next: Next) => {
	const authHeader = c.req.header('Authorization')

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		logger.warn('JWT authentication failed: No Bearer token provided')
		return c.json({ error: 'Unauthorized' }, 401)
	}

	const token = authHeader.split(' ')[1]

	try {
		const payload = await verify(token, CONFIG.JWT_ACCESS_SECRET)
		const userId = payload.userId as number
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

		logger.debug(`JWT authentication successful for user: ${userId}`)
		await next()
	} catch (_error) {
		logger.warn('JWT authentication failed: Invalid token')
		return c.json({ error: 'Invalid token' }, 401)
	}
}
