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

// Get authentication analytics/statistics for the authenticated user
authStats.get(
	'/',
	describeRoute({
		description: 'Get authentication analytics/statistics for the authenticated user.',
		tags: ['Auth Analytics'],
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
				description: 'Authentication analytics retrieved successfully',
				content: {
					'application/json': {
						example: {
							success: true,
							data: {
								stats: [
									{
										user_id: 1,
										date: '2024-05-01',
										success: true,
										attempts: 3,
										unique_ips: ['1.2.3.4'],
										unique_user_agents: ['Mozilla/5.0'],
										countries: ['US'],
										device_types: ['Desktop'],
										browsers: ['Chrome'],
										operating_systems: ['Windows']
									}
								],
								totalSuccess: 3,
								totalFailure: 1,
								uniqueIPs: 2,
								uniqueCountries: 1,
								uniqueDevices: 1
							}
						}
					}
				}
			},
			401: {
				description: 'Unauthorized',
				content: {
					'application/json': {
						example: { success: false, error: 'Unauthorized' }
					}
				}
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`Authentication analytics requested for user: ${userId}`)

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
				logger.debug(`Returning auth analytics for date range: ${formatDateRange(startDate.toISOString(), endDate.toISOString())}`)
			}

			// Ensure uniqueDevices is always present for consistency
			if (stats.success && stats.data && typeof stats.data.uniqueDevices === 'undefined') {
				return c.json({
					...stats,
					data: {
						...stats.data,
						uniqueDevices: 0
					}
				})
			}

			return c.json(stats)
		} catch (error) {
			logger.error(`Failed to get authentication analytics for user: ${userId}`, error)
			return c.json(
				{
					success: false,
					error: 'Failed to retrieve authentication analytics'
				},
				500
			)
		}
	}
)

// Get recent authentication events for the authenticated user
authStats.get(
	'/recent',
	describeRoute({
		description: 'Get recent authentication events for the authenticated user.',
		tags: ['Auth Analytics'],
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
				description: 'Recent authentication events retrieved successfully',
				content: {
					'application/json': {
						example: {
							success: true,
							data: {
								stats: [
									{
										user_id: 1,
										date: '2024-05-01',
										success: true,
										attempts: 1,
										unique_ips: ['1.2.3.4'],
										unique_user_agents: ['Mozilla/5.0'],
										countries: ['US'],
										device_types: ['Desktop'],
										browsers: ['Chrome'],
										operating_systems: ['Windows'],
										event_type: 1
									}
								],
								totalSuccess: 1,
								totalFailure: 0,
								uniqueIPs: 1,
								uniqueCountries: 1,
								uniqueDevices: 1
							}
						}
					}
				}
			},
			401: {
				description: 'Unauthorized',
				content: {
					'application/json': {
						example: { success: false, error: 'Unauthorized' }
					}
				}
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
			// Ensure uniqueDevices is always present for consistency
			if (events.success && events.data && typeof events.data.uniqueDevices === 'undefined') {
				return c.json({
					...events,
					data: {
						...events.data,
						uniqueDevices: 0
					}
				})
			}
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
