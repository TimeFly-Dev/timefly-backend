import { Hono } from 'hono'
import type { Context } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'
import { cookieAuthMiddleware } from '../middleware/cookieAuthMiddleware'
import { createApiKey, getApiKey, regenerateApiKey } from '../services/apiKeyService'
import { apiKeyResponseSchema } from '../validations/apiKeyValidations'
import { logger } from '../utils/logger'

const apiKeys = new Hono()

// Helper function to get client IP
const getClientIp = (c: Context): string => {
	return c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || 'unknown'
}
// Apply cookie authentication middleware to all routes
apiKeys.use('*', cookieAuthMiddleware)

// Get current API key
apiKeys.get(
	'/',
	describeRoute({
		description: 'Get current API key for authenticated user',
		tags: ['API Keys'],
		security: [{ bearerAuth: [] }],
		responses: {
			200: {
				description: 'API key retrieved successfully',
				content: {
					'application/json': {
						schema: resolver(apiKeyResponseSchema)
					}
				}
			},
			401: {
				description: 'Unauthorized'
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`API key requested for user: ${userId}`)

		const apiKey = await getApiKey(userId)

		if (!apiKey) {
			logger.info(`No API key found for user: ${userId}, creating new one`)

			// Create a new API key if none exists
			const eventInfo = {
				ip_address: getClientIp(c),
				user_agent: c.req.header('user-agent') || ''
			}

			const newApiKey = await createApiKey(userId, eventInfo)

			return c.json({
				success: true,
				data: {
					apiKey: newApiKey
				}
			})
		}

		logger.debug(`Returning existing API key for user: ${userId}`)
		return c.json({
			success: true,
			data: {
				apiKey
			}
		})
	}
)

// Regenerate API key (changed from POST to PUT)
apiKeys.put(
	'/',
	describeRoute({
		description: 'Regenerate API key for authenticated user',
		tags: ['API Keys'],
		security: [{ bearerAuth: [] }],
		responses: {
			200: {
				description: 'API key regenerated successfully',
				content: {
					'application/json': {
						schema: resolver(apiKeyResponseSchema)
					}
				}
			},
			401: {
				description: 'Unauthorized'
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`API key regeneration requested for user: ${userId}`)

		try {
			const eventInfo = {
				ip_address: getClientIp(c),
				user_agent: c.req.header('user-agent') || ''
			}

			const apiKey = await regenerateApiKey(userId, eventInfo)

			logger.info(`API key successfully regenerated for user: ${userId}`)
			return c.json({
				success: true,
				data: {
					apiKey
				}
			})
		} catch (error) {
			logger.error(`API key regeneration failed for user: ${userId}`, error)
			return c.json(
				{
					success: false,
					error: 'Failed to regenerate API key'
				},
				500
			)
		}
	}
)

export { apiKeys }
