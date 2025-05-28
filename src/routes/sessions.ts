import { Hono } from 'hono'
import type { Context } from 'hono'
import { describeRoute } from 'hono-openapi'
import { cookieAuthMiddleware } from '../middleware/cookieAuthMiddleware'
import { sessionService } from '../services/sessionService'
import { authEventService } from '../services/authEventService'
import { logger } from '../utils/logger'
import { getCookie } from 'hono/cookie'
import type { AuthStatsResponse } from '../types/authEvents'
import { getClientIp } from '../utils/getClientIp'

const sessions = new Hono()

// Apply cookie authentication middleware to all routes
sessions.use('*', cookieAuthMiddleware)

// Get all active sessions for the current user
sessions.get(
	'/',
	describeRoute({
		description: 'Get all active sessions for the authenticated user',
		tags: ['Sessions'],
		security: [{ bearerAuth: [] }],
		responses: {
			200: {
				description: 'Sessions retrieved successfully'
			},
			401: {
				description: 'Unauthorized'
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

// Revoke a specific session
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
				description: 'Session revoked successfully'
			},
			401: {
				description: 'Unauthorized'
			},
			404: {
				description: 'Session not found'
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

			// Log the session revocation event
			authEventService.logEvent({
				timestamp: new Date(),
				user_id: userId,
				email: '', // We don't have this information here
				success: true,
				ip_address: getClientIp(c),
				user_agent: c.req.header('user-agent') || '',
				country_code: 'UN',
				city: 'Unknown',
				provider: 'local',
				session_id: sessionId,
				event_type: 'revoked'
			})

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

// Revoke all other sessions
sessions.delete(
	'/',
	describeRoute({
		description: 'Revoke all sessions except the current one',
		tags: ['Sessions'],
		security: [{ bearerAuth: [] }],
		responses: {
			200: {
				description: 'Sessions revoked successfully'
			},
			401: {
				description: 'Unauthorized'
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

			// Log the session revocation events
			authEventService.logEvent({
				timestamp: new Date(),
				user_id: userId,
				email: '', // We don't have this information here
				success: true,
				ip_address: getClientIp(c),
				user_agent: c.req.header('user-agent') || '',
				country_code: 'UN',
				city: 'Unknown',
				provider: 'local',
				session_id: 'bulk-revocation',
				event_type: 'revoked'
			})

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

// Get session statistics
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
				description: 'Session statistics retrieved successfully'
			},
			401: {
				description: 'Unauthorized'
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`Session statistics requested for user: ${userId}`)

		// Get query parameters
		const startDateParam = c.req.query('startDate')
		const endDateParam = c.req.query('endDate')

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

// Get recent session events
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
				description: 'Maximum number of events to return'
			}
		],
		responses: {
			200: {
				description: 'Recent session events retrieved successfully'
			},
			401: {
				description: 'Unauthorized'
			}
		}
	}),
	async (c) => {
		const userId = c.get('userId')
		logger.info(`Recent session events requested for user: ${userId}`)

		// Get limit parameter
		const limitParam = c.req.query('limit')
		const limit = limitParam ? Number.parseInt(limitParam, 10) : 10

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
