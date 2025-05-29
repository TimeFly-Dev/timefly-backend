import { mysqlPool } from '../db/mysql'
import { randomBytes } from 'node:crypto'
import type mysql from 'mysql2/promise'
import { logger } from '../utils/logger'
import { apiKeyLoggingService } from './apiKeyLoggingService'
import type { ApiKeyEventInput } from '../types/apiKeyEvents'

/**
 * Type for event information when creating or regenerating API keys
 */
interface EventInfo {
	readonly ip_address: string
	readonly user_agent: string
	readonly country_code?: string
	readonly city?: string
	readonly device_name?: string
	readonly device_type?: string
	readonly browser?: string
	readonly os?: string
}

/**
 * Generates a cryptographically secure random API key
 * @returns {string} A random 32-character hexadecimal string
 */
const generateRandomApiKey = (): string => randomBytes(32).toString('hex')

/**
 * Creates a new API key for a user
 * @param {number} userId - The user ID to create an API key for
 * @param {EventInfo} eventInfo - Optional information for event logging
 * @returns {Promise<string>} The generated API key
 */
export const createApiKey = async (userId: number, eventInfo?: EventInfo): Promise<string> => {
	const connection = await mysqlPool.getConnection()

	try {
		// Check if user already has an active API key
		const [existingKeys] = await connection.execute<mysql.RowDataPacket[]>(
			'SELECT api_key, api_key_revoked_at FROM users WHERE id = ?',
			[userId]
		)

		if (existingKeys.length > 0 && existingKeys[0].api_key && !existingKeys[0].api_key_revoked_at) {
			logger.warn(`User ${userId} already has an active API key. Use regenerateApiKey instead.`)
			throw new Error('User already has an active API key')
		}

		const apiKey = generateRandomApiKey()
		logger.debug(`Creating new API key for user: ${userId}`)

		await connection.execute(
			`UPDATE users 
       SET api_key = ?, 
           api_key_created_at = CURRENT_TIMESTAMP,
           api_key_last_used_at = NULL,
           api_key_last_used_ip = NULL,
           api_key_last_used_user_agent = NULL,
           api_key_usage_count = 0,
           api_key_revoked_at = NULL,
           api_key_revoked_reason = NULL
       WHERE id = ?`,
			[apiKey, userId]
		)

		logger.info(`API key created successfully for user: ${userId}`)

		// Log the event to ClickHouse if eventInfo is provided
		if (eventInfo) {
			const eventData: ApiKeyEventInput = {
				user_id: userId,
				timestamp: new Date(),
				event_type: 'created',
				ip_address: eventInfo.ip_address,
				user_agent: eventInfo.user_agent,
				country_code: eventInfo.country_code,
				city: eventInfo.city,
				device_name: eventInfo.device_name,
				device_type: eventInfo.device_type,
				browser: eventInfo.browser,
				os: eventInfo.os
			}

			await apiKeyLoggingService.logEvent(eventData)
		}

		return apiKey
	} catch (error) {
		logger.error(`Failed to create API key for user ${userId}:`, error)
		throw error
	} finally {
		connection.release()
	}
}

/**
 * Regenerates an API key for a user, invalidating the previous key
 * @param {number} userId - The user ID to regenerate an API key for
 * @param {EventInfo} eventInfo - Optional information for event logging
 * @returns {Promise<string>} The newly generated API key
 */
export const regenerateApiKey = async (userId: number, eventInfo?: EventInfo): Promise<string> => {
	const connection = await mysqlPool.getConnection()

	try {
		logger.debug(`Starting API key regeneration for user: ${userId}`)

		// Get the current API key for logging purposes
		const [currentKeys] = await connection.execute<mysql.RowDataPacket[]>(
			'SELECT api_key, api_key_created_at FROM users WHERE id = ?',
			[userId]
		)

		if (currentKeys.length === 0) {
			throw new Error('User not found')
		}

		const currentKey = currentKeys[0].api_key
		const _currentKeyCreatedAt = currentKeys[0].api_key_created_at

		// Generate a new API key
		const newApiKey = generateRandomApiKey()

		// Update the user's API key and invalidate the old one
		await connection.execute(
			`UPDATE users 
       SET api_key = ?, 
           api_key_created_at = CURRENT_TIMESTAMP,
           api_key_last_used_at = NULL,
           api_key_last_used_ip = NULL,
           api_key_last_used_user_agent = NULL,
           api_key_usage_count = 0,
           api_key_revoked_at = CURRENT_TIMESTAMP,
           api_key_revoked_reason = 'Regenerated'
       WHERE id = ?`,
			[newApiKey, userId]
		)

		// Verify the key was actually changed
		if (currentKey && currentKey === newApiKey) {
			logger.warn(`Generated API key is identical to previous key for user: ${userId}. This is extremely unlikely.`)
		}

		logger.info(`API key regenerated successfully for user: ${userId}`)

		// Log the event to ClickHouse if eventInfo is provided
		if (eventInfo) {
			// Log the revocation of the old key
			if (currentKey) {
				const revokeEventData: ApiKeyEventInput = {
					user_id: userId,
					timestamp: new Date(),
					event_type: 'revoked',
					ip_address: eventInfo.ip_address,
					user_agent: eventInfo.user_agent,
					country_code: eventInfo.country_code,
					city: eventInfo.city,
					device_name: eventInfo.device_name,
					device_type: eventInfo.device_type,
					browser: eventInfo.browser,
					os: eventInfo.os
				}
				await apiKeyLoggingService.logEvent(revokeEventData)
			}

			// Log the creation of the new key
			const createEventData: ApiKeyEventInput = {
				user_id: userId,
				timestamp: new Date(),
				event_type: 'created',
				ip_address: eventInfo.ip_address,
				user_agent: eventInfo.user_agent,
				country_code: eventInfo.country_code,
				city: eventInfo.city,
				device_name: eventInfo.device_name,
				device_type: eventInfo.device_type,
				browser: eventInfo.browser,
				os: eventInfo.os
			}
			await apiKeyLoggingService.logEvent(createEventData)
		}

		return newApiKey
	} catch (error) {
		logger.error(`Failed to regenerate API key for user ${userId}:`, error)
		throw error
	} finally {
		connection.release()
	}
}

/**
 * Gets the current API key for a user
 * @param {number} userId - The user ID to get the API key for
 * @returns {Promise<string|null>} The API key or null if none exists
 */
export const getApiKey = async (userId: number): Promise<string | null> => {
	const connection = await mysqlPool.getConnection()

	try {
		logger.debug(`Fetching API key for user: ${userId}`)

		const [rows] = await connection.execute<mysql.RowDataPacket[]>('SELECT api_key FROM users WHERE id = ?', [userId])

		const result = rows.length > 0 ? rows[0].api_key : null

		if (result) {
			logger.debug(`API key found for user: ${userId}`)
		} else {
			logger.debug(`No API key found for user: ${userId}`)
		}

		return result
	} catch (error) {
		logger.error(`Failed to get API key for user ${userId}:`, error)
		throw error
	} finally {
		connection.release()
	}
}

/**
 * Validates an API key and returns the associated user ID
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<number|null>} The user ID or null if invalid
 */
export const validateApiKey = async (apiKey: string): Promise<number | null> => {
	const connection = await mysqlPool.getConnection()

	try {
		logger.debug(`Validating API key: ${apiKey}`)

		const [rows] = await connection.execute<mysql.RowDataPacket[]>('SELECT id FROM users WHERE api_key = ?', [apiKey])

		if (rows.length === 0) {
			logger.warn(`Invalid API key attempt: ${apiKey}`)
			return null
		}

		// Update last_used_at timestamp
		await connection.execute('UPDATE users SET api_key_last_used_at = CURRENT_TIMESTAMP WHERE api_key = ?', [apiKey])

		logger.debug(`API key validated successfully for user: ${rows[0].id}`)
		return rows[0].id
	} catch (error) {
		logger.error(`Error validating API key: ${apiKey}`, error)
		throw error
	} finally {
		connection.release()
	}
}
