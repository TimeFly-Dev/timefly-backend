import { Hono } from 'hono'
import type { Context } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'
import { cookieAuthMiddleware } from '../middleware/cookieAuthMiddleware'
import { createApiKey, getApiKey, regenerateApiKey } from '../services/apiKeyService'
import { apiKeyResponseSchema } from '../validations/apiKeyValidations'
import { logger } from '../utils/logger'
import { getClientIp } from '../utils/getClientIp'

const apiKeys = new Hono()

// Apply cookie authentication middleware to all routes
apiKeys.use('*', cookieAuthMiddleware)

// Get current API key
apiKeys.get(
	'/',
	describeRoute({
		description: 'Get current API key for authenticated user. If no API key exists, a new one will be created automatically.',
		tags: ['API Keys'],
		security: [{ bearerAuth: [] }],
		responses: {
			200: {
				description: 'API key retrieved or created successfully',
				content: {
					'application/json': {
						schema: resolver(apiKeyResponseSchema),
						example: {
							success: true,
							data: {
								apiKey: 'sk_live_1234567890abcdef'
							}
						}
					}
				}
			},
			401: {
				description: 'Unauthorized - User not authenticated',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'Unauthorized'
						}
					}
				}
			},
			500: {
				description: 'Internal server error',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'Failed to retrieve API key'
						}
					}
				}
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`API key requested for user: ${userId}`)

		try {
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
		} catch (error) {
			logger.error(`Error retrieving API key for user: ${userId}`, error)
			return c.json(
				{
					success: false,
					error: 'Failed to retrieve API key'
				},
				500
			)
		}
	}
)

// Regenerate API key
apiKeys.put(
	'/',
	describeRoute({
		description: 'Regenerate API key for authenticated user. This will invalidate the current API key and create a new one.',
		tags: ['API Keys'],
		security: [{ bearerAuth: [] }],
		responses: {
			200: {
				description: 'API key regenerated successfully',
				content: {
					'application/json': {
						schema: resolver(apiKeyResponseSchema),
						example: {
							success: true,
							data: {
								apiKey: 'sk_live_1234567890abcdef'
							}
						}
					}
				}
			},
			401: {
				description: 'Unauthorized - User not authenticated',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'Unauthorized'
						}
					}
				}
			},
			500: {
				description: 'Internal server error',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'Failed to regenerate API key'
						}
					}
				}
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
