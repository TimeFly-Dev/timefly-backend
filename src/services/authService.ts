import { sign, verify } from 'hono/jwt'
import { CONFIG } from '../config'
import { logger } from '../utils/logger'
import { sessionService } from './sessionService'
import { authEventService } from './authEventService'
import { parseUserAgent } from '../utils/deviceDetection'
import type { CreateSessionInput } from '../types/sessions'

/**
 * Client information interface for session tracking
 */
interface ClientInfo {
	ipAddress: string
	userAgent: string
}

/**
 * Generates JWT tokens for authentication
 * @param {object} dbUser - The user object
 * @param {ClientInfo|null} clientInfo - Optional client information for session tracking
 * @returns {Promise<{accessToken: string, refreshToken: string}>} The generated tokens
 */
export async function generateTokens(
	dbUser: {
		id: number
		email: string
		fullName: string
		avatarUrl: string
	},
	clientInfo: ClientInfo | null = null
): Promise<{
	accessToken: string
	refreshToken: string
}> {
	logger.debug(`Generating tokens for user: ${dbUser.id}`)

	// Generate access token
	const accessToken = await sign(
		{
			userId: dbUser.id,
			email: dbUser.email,
			fullName: dbUser.fullName,
			avatarUrl: dbUser.avatarUrl
		},
		CONFIG.JWT_ACCESS_SECRET,
		'HS256'
	)

	// Generate refresh token
	const refreshToken = await sign({ userId: dbUser.id }, CONFIG.JWT_REFRESH_SECRET, 'HS256')

	// If client info is provided, create a session
	if (clientInfo) {
		try {
			// Parse user agent for device information
			const deviceInfo = parseUserAgent(clientInfo.userAgent)

			// Calculate expiration date based on refresh token expiration
			// Parse the expiration time from the config
			const expiresInValue = CONFIG.REFRESH_TOKEN_EXPIRES_IN
			const expiresAt = new Date()

			// Handle different formats like "30d", "24h", "60m"
			if (typeof expiresInValue === 'string') {
				const match = expiresInValue.match(/^(\d+)([dhms])$/)
				if (match) {
					const value = Number.parseInt(match[1], 10)
					const unit = match[2]

					switch (unit) {
						case 'd':
							expiresAt.setDate(expiresAt.getDate() + value)
							break
						case 'h':
							expiresAt.setHours(expiresAt.getHours() + value)
							break
						case 'm':
							expiresAt.setMinutes(expiresAt.getMinutes() + value)
							break
						case 's':
							expiresAt.setSeconds(expiresAt.getSeconds() + value)
							break
					}
				} else {
					// Default to 30 days if format is not recognized
					expiresAt.setDate(expiresAt.getDate() + 30)
				}
			} else {
				// Default to 30 days if not a string
				expiresAt.setDate(expiresAt.getDate() + 30)
			}

			// Create session data
			const sessionData: CreateSessionInput = {
				user_id: dbUser.id,
				refresh_token: refreshToken,
				device_name: deviceInfo.deviceName,
				device_type: deviceInfo.deviceType,
				browser: deviceInfo.browser,
				os: deviceInfo.os,
				ip_address: clientInfo.ipAddress,
				expires_at: expiresAt
			}

			// Create session
			const sessionId = await sessionService.createSession(sessionData)

			// Log session creation event using the auth event service
			authEventService.logEvent({
				timestamp: new Date(),
				user_id: dbUser.id,
				email: dbUser.email,
				success: true,
				ip_address: clientInfo.ipAddress,
				user_agent: clientInfo.userAgent,
				country_code: 'UN', // Default value
				city: 'Unknown', // Default value
				provider: 'local',
				session_id: sessionId, // Add session_id to auth events
				device_info: {
					device_name: deviceInfo.deviceName,
					device_type: deviceInfo.deviceType,
					browser: deviceInfo.browser,
					os: deviceInfo.os
				}
			})
		} catch (error) {
			logger.error(`Failed to create session for user ${dbUser.id}:`, error)
			// Continue even if session creation fails
		}
	}

	logger.debug(`Tokens generated successfully for user: ${dbUser.id}`)
	return { accessToken, refreshToken }
}

/**
 * Verifies a JWT access token
 * @param {string} token - The JWT token to verify
 * @returns {Promise<number>} The user ID from the token
 */
export async function verifyAccessToken(token: string): Promise<number> {
	try {
		logger.debug('Verifying access token')
		const payload = await verify(token, CONFIG.JWT_ACCESS_SECRET, 'HS256')
		logger.debug(`Access token verified for user: ${payload.userId}`)
		return payload.userId as number
	} catch (error) {
		logger.error('Access token verification failed:', error)
		throw new Error('Invalid access token')
	}
}

/**
 * Verifies a JWT refresh token
 * @param {string} token - The JWT refresh token to verify
 * @returns {Promise<number>} The user ID from the token
 */
export async function verifyRefreshToken(token: string): Promise<number> {
	try {
		logger.debug('Verifying refresh token')
		const payload = await verify(token, CONFIG.JWT_REFRESH_SECRET, 'HS256')
		const userId = payload.userId as number

		// Check if the token is associated with an active session
		const session = await sessionService.getSessionByRefreshToken(token)
		if (!session) {
			logger.error('No active session found for refresh token')
			throw new Error('Invalid or expired session')
		}

		// Update session activity
		await sessionService.updateSessionActivity(session.id)

		// Log session refresh event using the auth event service
		authEventService.logEvent({
			timestamp: new Date(),
			user_id: userId,
			email: '', // We don't have this information here
			success: true,
			ip_address: session.ip_address,
			user_agent: '', // We don't have this information here
			country_code: 'UN',
			city: 'Unknown',
			provider: 'local',
			session_id: session.id,
			event_type: 'refreshed' // Add event_type to auth events
		})

		logger.debug(`Refresh token verified for user: ${userId}`)
		return userId
	} catch (error) {
		logger.error('Refresh token verification failed:', error)
		throw new Error('Invalid refresh token')
	}
}
