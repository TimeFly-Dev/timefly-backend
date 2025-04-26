import { mysqlPool } from '../db/mysql'
import { randomBytes } from 'node:crypto'
import type mysql from 'mysql2/promise'
import { logger } from '../utils/logger'
import type { CreateSessionInput, UserSession } from '../types/sessions'

/**
 * Service for managing user sessions
 */
export const sessionService = {
	/**
	 * Creates a new session for a user
	 * @param {CreateSessionInput} sessionData - The session data
	 * @returns {Promise<string>} The session ID
	 */
	createSession: async (sessionData: CreateSessionInput): Promise<string> => {
		const connection = await mysqlPool.getConnection()

		try {
			// Generate a unique session ID
			const sessionId = randomBytes(32).toString('hex')
			logger.debug(`Creating new session for user: ${sessionData.user_id}`)

			await connection.execute(
				`INSERT INTO user_sessions 
        (id, user_id, refresh_token, device_name, device_type, browser, os, ip_address, expires_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					sessionId,
					sessionData.user_id,
					sessionData.refresh_token,
					sessionData.device_name || 'Unknown device',
					sessionData.device_type || 'Unknown',
					sessionData.browser || 'Unknown',
					sessionData.os || 'Unknown',
					sessionData.ip_address,
					sessionData.expires_at
				]
			)

			logger.info(`Session created successfully for user: ${sessionData.user_id}`)

			return sessionId
		} catch (error) {
			logger.error(`Failed to create session for user ${sessionData.user_id}:`, error)
			throw error
		} finally {
			connection.release()
		}
	},

	/**
	 * Gets a session by its ID
	 * @param {string} sessionId - The session ID
	 * @returns {Promise<UserSession | null>} The session or null if not found
	 */
	getSessionById: async (sessionId: string): Promise<UserSession | null> => {
		const connection = await mysqlPool.getConnection()

		try {
			logger.debug(`Fetching session: ${sessionId}`)

			const [rows] = await connection.execute<mysql.RowDataPacket[]>(
				'SELECT * FROM user_sessions WHERE id = ? AND is_revoked = FALSE AND expires_at > NOW()',
				[sessionId]
			)

			if (rows.length === 0) {
				logger.debug(`No active session found with ID: ${sessionId}`)
				return null
			}

			const session = rows[0] as UserSession
			logger.debug(`Session found: ${sessionId}`)

			return session
		} catch (error) {
			logger.error(`Failed to get session ${sessionId}:`, error)
			throw error
		} finally {
			connection.release()
		}
	},

	/**
	 * Gets a session by refresh token
	 * @param {string} refreshToken - The refresh token
	 * @returns {Promise<UserSession | null>} The session or null if not found
	 */
	getSessionByRefreshToken: async (refreshToken: string): Promise<UserSession | null> => {
		const connection = await mysqlPool.getConnection()

		try {
			logger.debug('Fetching session by refresh token')

			const [rows] = await connection.execute<mysql.RowDataPacket[]>(
				'SELECT * FROM user_sessions WHERE refresh_token = ? AND is_revoked = FALSE AND expires_at > NOW()',
				[refreshToken]
			)

			if (rows.length === 0) {
				logger.debug('No active session found with the provided refresh token')
				return null
			}

			const session = rows[0] as UserSession
			logger.debug(`Session found by refresh token: ${session.id}`)

			return session
		} catch (error) {
			logger.error('Failed to get session by refresh token:', error)
			throw error
		} finally {
			connection.release()
		}
	},

	/**
	 * Gets all active sessions for a user
	 * @param {number} userId - The user ID
	 * @returns {Promise<readonly UserSession[]>} The active sessions
	 */
	getUserSessions: async (userId: number): Promise<readonly UserSession[]> => {
		const connection = await mysqlPool.getConnection()

		try {
			logger.debug(`Fetching active sessions for user: ${userId}`)

			const [rows] = await connection.execute<mysql.RowDataPacket[]>(
				'SELECT * FROM user_sessions WHERE user_id = ? AND is_revoked = FALSE AND expires_at > NOW() ORDER BY last_active DESC',
				[userId]
			)

			logger.debug(`Found ${rows.length} active sessions for user: ${userId}`)

			return rows as UserSession[]
		} catch (error) {
			logger.error(`Failed to get sessions for user ${userId}:`, error)
			throw error
		} finally {
			connection.release()
		}
	},

	/**
	 * Updates the last active timestamp for a session
	 * @param {string} sessionId - The session ID
	 * @returns {Promise<void>}
	 */
	updateSessionActivity: async (sessionId: string): Promise<void> => {
		const connection = await mysqlPool.getConnection()

		try {
			logger.debug(`Updating last active timestamp for session: ${sessionId}`)

			await connection.execute('UPDATE user_sessions SET last_active = CURRENT_TIMESTAMP WHERE id = ?', [sessionId])

			logger.debug(`Session activity updated: ${sessionId}`)
		} catch (error) {
			logger.error(`Failed to update session activity for ${sessionId}:`, error)
			throw error
		} finally {
			connection.release()
		}
	},

	/**
	 * Revokes a session
	 * @param {string} sessionId - The session ID
	 * @param {string} userId - The user ID (for authorization check)
	 * @returns {Promise<boolean>} True if the session was revoked
	 */
	revokeSession: async (sessionId: string, userId: number): Promise<boolean> => {
		const connection = await mysqlPool.getConnection()

		try {
			logger.debug(`Revoking session: ${sessionId} for user: ${userId}`)

			const [result] = await connection.execute<mysql.ResultSetHeader>(
				'UPDATE user_sessions SET is_revoked = TRUE WHERE id = ? AND user_id = ?',
				[sessionId, userId]
			)

			const wasRevoked = result.affectedRows > 0

			if (wasRevoked) {
				logger.info(`Session ${sessionId} revoked successfully`)
			} else {
				logger.warn(`Failed to revoke session ${sessionId}: Session not found or not owned by user ${userId}`)
			}

			return wasRevoked
		} catch (error) {
			logger.error(`Failed to revoke session ${sessionId}:`, error)
			throw error
		} finally {
			connection.release()
		}
	},

	/**
	 * Revokes all sessions for a user except the current one
	 * @param {number} userId - The user ID
	 * @param {string} currentSessionId - The current session ID to exclude
	 * @returns {Promise<number>} The number of revoked sessions
	 */
	revokeAllOtherSessions: async (userId: number, currentSessionId: string): Promise<number> => {
		const connection = await mysqlPool.getConnection()

		try {
			logger.debug(`Revoking all sessions for user: ${userId} except: ${currentSessionId}`)

			const [result] = await connection.execute<mysql.ResultSetHeader>(
				'UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = ? AND id != ? AND is_revoked = FALSE',
				[userId, currentSessionId]
			)

			const revokedCount = result.affectedRows
			logger.info(`Revoked ${revokedCount} sessions for user: ${userId}`)

			return revokedCount
		} catch (error) {
			logger.error(`Failed to revoke sessions for user ${userId}:`, error)
			throw error
		} finally {
			connection.release()
		}
	},

	/**
	 * Cleans up expired sessions
	 * @returns {Promise<number>} The number of cleaned up sessions
	 */
	cleanupExpiredSessions: async (): Promise<number> => {
		const connection = await mysqlPool.getConnection()

		try {
			logger.debug('Cleaning up expired sessions')

			const [result] = await connection.execute<mysql.ResultSetHeader>(
				'UPDATE user_sessions SET is_revoked = TRUE WHERE expires_at < NOW() AND is_revoked = FALSE'
			)

			const cleanedCount = result.affectedRows
			logger.info(`Cleaned up ${cleanedCount} expired sessions`)

			return cleanedCount
		} catch (error) {
			logger.error('Failed to clean up expired sessions:', error)
			throw error
		} finally {
			connection.release()
		}
	}
}
