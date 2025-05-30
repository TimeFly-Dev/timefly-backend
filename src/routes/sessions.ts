import { Hono } from 'hono'
import type { Context } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi/zod'
import { cookieAuthMiddleware } from '../middleware/cookieAuthMiddleware'
import { sessionService } from '../services/sessionService'
import { authEventService } from '../services/authEventService'
import { logger } from '../utils/logger'
import { getCookie } from 'hono/cookie'
import type { AuthStatsResponse } from '../types/authEvents'
import { getClientIp } from '../utils/getClientIp'
import { parseUserAgent } from '../utils/deviceDetection'
import { sessionResponseSchema, sessionStatsQuerySchema, sessionRevocationResponseSchema } from '../validations/sessionsValidations'
import { getUserById } from '../services/userService'

const sessions = new Hono()

// Apply cookie authentication middleware to all routes
sessions.use('*', cookieAuthMiddleware)

/**
 * Get all active sessions for the current user
 * @route GET /sessions
 */
sessions.get(
	'/',
	describeRoute({
		description: 'Get all active sessions for the authenticated user',
		tags: ['Sessions'],
		security: [{ bearerAuth: [] }],
		responses: {
			200: {
				description: 'Sessions retrieved successfully',
				content: {
					'application/json': {
						schema: resolver(sessionResponseSchema),
						example: {
							success: true,
							data: {
								sessions: [
									{
										id: 'abc123',
										device_name: 'Chrome on Windows',
										device_type: 'desktop',
										browser: 'Chrome',
										os: 'Windows',
										ip_address: '127.0.0.1',
										last_active: '2024-03-20T12:00:00Z',
										created_at: '2024-03-19T12:00:00Z'
									}
								],
								currentSession: 'abc123'
							}
						}
					}
				}
			},
			401: {
				description: 'Unauthorized',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'Authentication required'
						}
					}
				}
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`Sessions requested for user: ${userId}`)

		try {
			const userSessions = await sessionService.getUserSessions(userId)

			// Get the current session ID from the refresh token cookie
			const refreshToken = getCookie(c, 'refresh_token')
			let currentSessionId = null

			if (refreshToken) {
				const currentSession = await sessionService.getSessionByRefreshToken(refreshToken)
				if (currentSession) {
					currentSessionId = currentSession.id
				}
			}

			return c.json({
				success: true,
				data: {
					sessions: userSessions,
					currentSession: currentSessionId
				}
			})
		} catch (error) {
			logger.error(`Failed to get sessions for user: ${userId}`, error)
			return c.json(
				{
					success: false,
					error: 'Failed to retrieve sessions'
				},
				500
			)
		}
	}
)

/**
 * Revoke a specific session
 * @route DELETE /sessions/:sessionId
 */
sessions.delete(
	'/:sessionId',
	describeRoute({
		description: 'Revoke a specific session',
		tags: ['Sessions'],
		security: [{ bearerAuth: [] }],
		parameters: [
			{
				name: 'sessionId',
				in: 'path',
				required: true,
				schema: { type: 'string' },
				description: 'The ID of the session to revoke'
			}
		],
		responses: {
			200: {
				description: 'Session revoked successfully',
				content: {
					'application/json': {
						schema: resolver(sessionRevocationResponseSchema),
						example: {
							success: true,
							message: 'Session revoked successfully'
						}
					}
				}
			},
			400: {
				description: 'Bad request',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'Cannot revoke the current session'
						}
					}
				}
			},
			401: {
				description: 'Unauthorized',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'Authentication required'
						}
					}
				}
			},
			404: {
				description: 'Session not found',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'Session not found or not owned by you'
						}
					}
				}
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		const sessionId = c.req.param('sessionId')
		logger.info(`Session revocation requested for user: ${userId}, session: ${sessionId}`)

		try {
			// Check if this is the current session
			const refreshToken = getCookie(c, 'refresh_token')
			if (refreshToken) {
				const currentSession = await sessionService.getSessionByRefreshToken(refreshToken)
				if (currentSession && currentSession.id === sessionId) {
					logger.warn(`User ${userId} attempted to revoke their current session: ${sessionId}`)
					return c.json(
						{
							success: false,
							error: 'Cannot revoke the current session. Use the logout endpoint instead.'
						},
						400
					)
				}
			}

			const wasRevoked = await sessionService.revokeSession(sessionId, userId)

			if (!wasRevoked) {
				logger.warn(`Session not found or not owned by user: ${userId}, session: ${sessionId}`)
				return c.json(
					{
						success: false,
						error: 'Session not found or not owned by you'
					},
					404
				)
			}

			// Get user email for logging
			const userData = await getUserById(userId)
			
			// Log the session revocation event
			await authEventService.logSessionEvent(c, userId, userData?.email || '', 'revoked', sessionId)

			logger.info(`Session revoked successfully: ${sessionId}`)
			return c.json({
				success: true,
				message: 'Session revoked successfully'
			})
		} catch (error) {
			logger.error(`Failed to revoke session: ${sessionId}`, error)
			return c.json(
				{
					success: false,
					error: 'Failed to revoke session'
				},
				500
			)
		}
	}
)

/**
 * Revoke all other sessions
 * @route DELETE /sessions
 */
sessions.delete(
	'/',
	describeRoute({
		description: 'Revoke all sessions except the current one',
		tags: ['Sessions'],
		security: [{ bearerAuth: [] }],
		responses: {
			200: {
				description: 'Sessions revoked successfully',
				content: {
					'application/json': {
						schema: resolver(sessionRevocationResponseSchema),
						example: {
							success: true,
							data: {
								revokedCount: 2
							},
							message: '2 sessions revoked successfully'
						}
					}
				}
			},
			400: {
				description: 'Bad request',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'No active session found'
						}
					}
				}
			},
			401: {
				description: 'Unauthorized',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'Authentication required'
						}
					}
				}
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`All sessions revocation requested for user: ${userId}`)

		try {
			// Get the current session ID
			const refreshToken = getCookie(c, 'refresh_token')
			if (!refreshToken) {
				logger.warn(`No refresh token found for user: ${userId}`)
				return c.json(
					{
						success: false,
						error: 'No active session found'
					},
					400
				)
			}

			const currentSession = await sessionService.getSessionByRefreshToken(refreshToken)
			if (!currentSession) {
				logger.warn(`No active session found for user: ${userId}`)
				return c.json(
					{
						success: false,
						error: 'No active session found'
					},
					400
				)
			}

			const revokedCount = await sessionService.revokeAllOtherSessions(userId, currentSession.id)

			// Get user email for logging
			const userData = await getUserById(userId)

			// Log the session revocation events
			await authEventService.logSessionEvent(c, userId, userData?.email || '', 'revoked', 'bulk-revocation')

			logger.info(`${revokedCount} sessions revoked for user: ${userId}`)
			return c.json({
				success: true,
				data: {
					revokedCount
				},
				message: `${revokedCount} sessions revoked successfully`
			})
		} catch (error) {
			logger.error(`Failed to revoke sessions for user: ${userId}`, error)
			return c.json(
				{
					success: false,
					error: 'Failed to revoke sessions'
				},
				500
			)
		}
	}
)

/**
 * Get session statistics
 * @route GET /sessions/stats
 */
sessions.get(
	'/stats',
	describeRoute({
		description: 'Get session statistics for authenticated user',
		tags: ['Sessions'],
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
				description: 'Session statistics retrieved successfully',
				content: {
					'application/json': {
						schema: resolver(sessionResponseSchema),
						example: {
							success: true,
							data: {
								stats: [
									{
										date: '2024-03-20',
										event_type: 'login',
										event_count: 5
									}
								]
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
				description: 'Unauthorized',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'Authentication required'
						}
					}
				}
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`Session statistics requested for user: ${userId}`)

		// Get and validate query parameters
		const startDateParam = c.req.query('startDate')
		const endDateParam = c.req.query('endDate')

		const queryResult = sessionStatsQuerySchema.safeParse({
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
			const stats: AuthStatsResponse = await authEventService.getSessionStats(userId, startDate, endDate)
			return c.json(stats)
		} catch (error) {
			logger.error(`Failed to get session statistics for user: ${userId}`, error)
			return c.json(
				{
					success: false,
					error: 'Failed to retrieve session statistics'
				},
				500
			)
		}
	}
)

/**
 * Get recent session events
 * @route GET /sessions/recent
 */
sessions.get(
	'/recent',
	describeRoute({
		description: 'Get recent session events for authenticated user',
		tags: ['Sessions'],
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
				description: 'Recent session events retrieved successfully',
				content: {
					'application/json': {
						schema: resolver(sessionResponseSchema),
						example: {
							success: true,
							data: {
								stats: [
									{
										date: '2024-03-20',
										event_type: 'login',
										event_count: 1
									}
								]
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
				description: 'Unauthorized',
				content: {
					'application/json': {
						example: {
							success: false,
							error: 'Authentication required'
						}
					}
				}
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`Recent session events requested for user: ${userId}`)

		// Get and validate limit parameter
		const limitParam = c.req.query('limit')
		const queryResult = sessionStatsQuerySchema.safeParse({
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
			const events: AuthStatsResponse = await authEventService.getRecentEvents(userId, limit)
			return c.json(events)
		} catch (error) {
			logger.error(`Failed to get recent session events for user: ${userId}`, error)
			return c.json(
				{
					success: false,
					error: 'Failed to retrieve recent session events'
				},
				500
			)
		}
	}
)

export { sessions }
