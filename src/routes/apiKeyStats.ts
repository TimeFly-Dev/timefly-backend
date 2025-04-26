import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { cookieAuthMiddleware } from '../middleware/cookieAuthMiddleware'
import { apiKeyLoggingService } from '../services/apiKeyLoggingService'
import { logger } from '../utils/logger'
import type { ApiKeyStatsResponse } from '../types/apiKeyEvents'

const apiKeyStats = new Hono()

// Apply cookie authentication middleware to all routes
apiKeyStats.use('*', cookieAuthMiddleware)

// Get API key statistics
apiKeyStats.get(
	'/',
	describeRoute({
		description: 'Get API key statistics for authenticated user',
		tags: ['API Keys'],
		security: [{ bearerAuth: [] }],
		parameters: [
			{
				name: 'startDate',
				in: 'query',
				schema: { type: 'string', format: 'date' },
				description: 'Start date for statistics (YYYY-MM-DD)'
			},
			{
				name: 'endDate',
				in: 'query',
				schema: { type: 'string', format: 'date' },
				description: 'End date for statistics (YYYY-MM-DD)'
			}
		],
		responses: {
			200: {
				description: 'API key statistics retrieved successfully'
			},
			401: {
				description: 'Unauthorized'
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`API key statistics requested for user: ${userId}`)

		// Get query parameters
		const startDateParam = c.req.query('startDate')
		const endDateParam = c.req.query('endDate')

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
					error: 'Failed to retrieve API key statistics'
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
		description: 'Get recent API key events for authenticated user',
		tags: ['API Keys'],
		security: [{ bearerAuth: [] }],
		parameters: [
			{
				name: 'limit',
				in: 'query',
				schema: { type: 'integer', minimum: 1, maximum: 100 },
				description: 'Maximum number of events to return'
			}
		],
		responses: {
			200: {
				description: 'Recent API key events retrieved successfully'
			},
			401: {
				description: 'Unauthorized'
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`Recent API key events requested for user: ${userId}`)

		// Get limit parameter
		const limitParam = c.req.query('limit')
		const limit = limitParam ? Number.parseInt(limitParam, 10) : 10

		try {
			const events: ApiKeyStatsResponse = await apiKeyLoggingService.getRecentEvents(userId, limit)
			return c.json(events)
		} catch (error) {
			logger.error(`Failed to get recent API key events for user: ${userId}`, error)
			return c.json(
				{
					success: false,
					error: 'Failed to retrieve recent API key events'
				},
				500
			)
		}
	}
)

export { apiKeyStats }
