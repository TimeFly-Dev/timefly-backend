import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'
import { cookieAuthMiddleware } from '../middleware/cookieAuthMiddleware'
import { apiKeyLoggingService } from '../services/apiKeyLoggingService'
import { logger } from '../utils/logger'
import type { ApiKeyStatsResponse } from '../types/apiKeyEvents'
import { apiKeyStatsResponseSchema, apiKeyStatsQuerySchema } from '../validations/apiKeyStatsValidations'

const apiKeyStats = new Hono()

// Apply cookie authentication middleware to all routes
apiKeyStats.use('*', cookieAuthMiddleware)

// Get API key statistics
apiKeyStats.get(
	'/',
	describeRoute({
		description: 'Get API key statistics for authenticated user. Returns daily statistics for API key events including creation and regeneration counts.',
		tags: ['API Keys'],
		security: [{ bearerAuth: [] }],
		parameters: [
			{
				name: 'startDate',
				in: 'query',
				schema: { type: 'string', format: 'date' },
				description: 'Start date for statistics (YYYY-MM-DD). Defaults to 30 days ago if not specified.'
			},
			{
				name: 'endDate',
				in: 'query',
				schema: { type: 'string', format: 'date' },
				description: 'End date for statistics (YYYY-MM-DD). Defaults to current date if not specified.'
			}
		],
		responses: {
			200: {
				description: 'API key statistics retrieved successfully',
				content: {
					'application/json': {
						schema: resolver(apiKeyStatsResponseSchema),
						example: {
							success: true,
							data: {
								stats: [
									{
										user_id: 1,
										date: '2024-03-20',
										event_type: 1,
										event_count: 1
									}
								],
								totalCreated: 1,
								totalRegenerated: 0
							}
						}
					}
				}
			},
			400: {
				description: 'Bad request - Invalid date format',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'Invalid date format. Use YYYY-MM-DD'
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
							error: 'Failed to retrieve API key statistics'
						}
					}
				}
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`API key statistics requested for user: ${userId}`)

		// Get query parameters
		const startDateParam = c.req.query('startDate')
		const endDateParam = c.req.query('endDate')

		// Validate query parameters using Zod schema
		const queryResult = apiKeyStatsQuerySchema.safeParse({
			startDate: startDateParam,
			endDate: endDateParam
		})

		if (!queryResult.success) {
			logger.warn(`Invalid query parameters for user: ${userId}`, queryResult.error)
			return c.json(
				{
					success: false,
					error: 'Invalid date format. Use YYYY-MM-DD'
				},
				400
			)
		}

		// Default to last 30 days if not specified
		const endDate = endDateParam ? new Date(endDateParam) : new Date()
		const startDate = startDateParam ? new Date(startDateParam) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)

		try {
			const stats: ApiKeyStatsResponse = await apiKeyLoggingService.getStats(userId, startDate, endDate)
			return c.json(stats)
		} catch (error) {
			logger.error(`Failed to get API key statistics for user: ${userId}`, error)
			return c.json(
				{
					success: false,
					error: `Failed to retrieve API key statistics: ${error instanceof Error ? error.message : String(error)}`
				},
				500
			)
		}
	}
)

// Get recent API key events
apiKeyStats.get(
	'/recent',
	describeRoute({
		description: 'Get recent API key events for authenticated user. Returns the most recent API key events including creation and regeneration events.',
		tags: ['API Keys'],
		security: [{ bearerAuth: [] }],
		parameters: [
			{
				name: 'limit',
				in: 'query',
				schema: { type: 'integer', minimum: 1, maximum: 100 },
				description: 'Maximum number of events to return. Defaults to 10 if not specified.'
			}
		],
		responses: {
			200: {
				description: 'Recent API key events retrieved successfully',
				content: {
					'application/json': {
						schema: resolver(apiKeyStatsResponseSchema),
						example: {
							success: true,
							data: {
								stats: [
									{
										user_id: 1,
										date: '2024-03-20',
										event_type: 1,
										event_count: 1
									}
								],
								totalCreated: 1,
								totalRegenerated: 0
							}
						}
					}
				}
			},
			400: {
				description: 'Bad request - Invalid limit parameter',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'Invalid limit parameter. Must be between 1 and 100'
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
							error: 'Failed to retrieve recent API key events'
						}
					}
				}
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`Recent API key events requested for user: ${userId}`)

		// Get and validate limit parameter using Zod schema
		const limitParam = c.req.query('limit')
		const queryResult = apiKeyStatsQuerySchema.safeParse({
			limit: limitParam ? Number.parseInt(limitParam, 10) : undefined
		})

		if (!queryResult.success) {
			logger.warn(`Invalid limit parameter for user: ${userId}`, queryResult.error)
			return c.json(
				{
					success: false,
					error: 'Invalid limit parameter. Must be between 1 and 100'
				},
				400
			)
		}

		const limit = queryResult.data.limit ?? 10

		try {
			const events: ApiKeyStatsResponse = await apiKeyLoggingService.getRecentEvents(userId, limit)
			return c.json(events)
		} catch (error) {
			logger.error(`Failed to get recent API key events for user: ${userId}`, error)
			return c.json(
				{
					success: false,
					error: `Failed to retrieve recent API key events: ${error instanceof Error ? error.message : String(error)}`
				},
				500
			)
		}
	}
)

export { apiKeyStats }
