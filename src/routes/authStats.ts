import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { cookieAuthMiddleware } from '../middleware/cookieAuthMiddleware'
import { authStatsService } from '../services/authStatsService'
import { logger } from '../utils/logger'
import type { AuthStatsResponse } from '../types/authEvents'
import { formatDateRange } from '../utils/timeFormatters'

const authStats = new Hono()

// Apply cookie authentication middleware to all routes
authStats.use('*', cookieAuthMiddleware)

// Get authentication statistics
authStats.get(
	'/',
	describeRoute({
		description: 'Get authentication statistics for authenticated user',
		tags: ['Authentication'],
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
				description: 'Authentication statistics retrieved successfully'
			},
			401: {
				description: 'Unauthorized'
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`Authentication statistics requested for user: ${userId}`)

		// Get query parameters
		const startDateParam = c.req.query('startDate')
		const endDateParam = c.req.query('endDate')

		// Default to last 30 days if not specified
		const endDate = endDateParam ? new Date(endDateParam) : new Date()
		const startDate = startDateParam ? new Date(startDateParam) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)

		try {
			const stats: AuthStatsResponse = await authStatsService.getStats(userId, startDate, endDate)

			// Add date range to response
			if (stats.success && stats.data) {
				logger.debug(`Returning auth stats for date range: ${formatDateRange(startDate.toISOString(), endDate.toISOString())}`)
			}

			return c.json(stats)
		} catch (error) {
			logger.error(`Failed to get authentication statistics for user: ${userId}`, error)
			return c.json(
				{
					success: false,
					error: 'Failed to retrieve authentication statistics'
				},
				500
			)
		}
	}
)

// Get recent authentication events
authStats.get(
	'/recent',
	describeRoute({
		description: 'Get recent authentication events for authenticated user',
		tags: ['Authentication'],
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
				description: 'Recent authentication events retrieved successfully'
			},
			401: {
				description: 'Unauthorized'
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`Recent authentication events requested for user: ${userId}`)

		// Get limit parameter
		const limitParam = c.req.query('limit')
		const limit = limitParam ? Number.parseInt(limitParam, 10) : 10

		try {
			const events: AuthStatsResponse = await authStatsService.getRecentEvents(userId, limit)
			return c.json(events)
		} catch (error) {
			logger.error(`Failed to get recent authentication events for user: ${userId}`, error)
			return c.json(
				{
					success: false,
					error: 'Failed to retrieve recent authentication events'
				},
				500
			)
		}
	}
)

export { authStats }
