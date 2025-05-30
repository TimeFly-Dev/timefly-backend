import { clickhouseClient } from '../db/clickhouse'
import { CONFIG } from '../config'
import { logger } from '../utils/logger'
import type { AuthEventInput, AuthDailyStat, AuthStatsResponse } from '../types/authEvents'
import { parseUserAgent } from '../utils/deviceDetection'
import type { Context } from 'hono'
import { getClientIp } from '../utils/getClientIp'

/**
 * Service for logging authentication events to ClickHouse
 */
class AuthEventService {
	private queue: readonly AuthEventInput[] = []
	private isProcessing = false

	/**
	 * Creates a base event with common information from the context
	 */
	private createBaseEvent(c: Context, userId: number, email: string): Omit<AuthEventInput, 'success' | 'provider' | 'event_type'> {
		const userAgent = c.req.header('user-agent') || ''
		const parsedUserAgent = parseUserAgent(userAgent)

		return {
			timestamp: new Date(),
			user_id: userId,
			email,
			ip_address: getClientIp(c),
			user_agent: userAgent,
			country_code: 'UN', // TODO: Implement geo-ip service
			city: 'Unknown', // TODO: Implement geo-ip service
			device_info: {
				device_name: parsedUserAgent.deviceName,
				device_type: parsedUserAgent.deviceType,
				browser: parsedUserAgent.browser,
				os: parsedUserAgent.os
			}
		}
	}

	/**
	 * Logs a successful authentication event
	 */
	async logSuccess(c: Context, userId: number, email: string, provider: 'google' | 'github' | 'local', eventType?: 'created' | 'refreshed' | 'expired' | 'revoked'): Promise<void> {
		const baseEvent = this.createBaseEvent(c, userId, email)
		await this.logEvent({
			...baseEvent,
			success: true,
			provider,
			event_type: eventType
		})
	}

	/**
	 * Logs a failed authentication event
	 */
	async logFailure(c: Context, userId: number, email: string, provider: 'google' | 'github' | 'local', errorMessage: string): Promise<void> {
		const baseEvent = this.createBaseEvent(c, userId, email)
		await this.logEvent({
			...baseEvent,
			success: false,
			provider,
			error_message: errorMessage
		})
	}

	/**
	 * Logs a session event
	 */
	async logSessionEvent(c: Context, userId: number, email: string, eventType: 'created' | 'refreshed' | 'expired' | 'revoked', sessionId?: string): Promise<void> {
		const baseEvent = this.createBaseEvent(c, userId, email)
		await this.logEvent({
			...baseEvent,
			success: true,
			provider: 'local',
			event_type: eventType,
			session_id: sessionId
		})
	}

	/**
	 * Logs a session event without a full context
	 */
	async logSessionEventWithoutContext(
		userId: number,
		email: string,
		eventType: 'created' | 'refreshed' | 'expired' | 'revoked',
		ipAddress: string,
		userAgent: string,
		sessionId?: string
	): Promise<void> {
		const parsedUserAgent = parseUserAgent(userAgent)
		await this.logEvent({
			timestamp: new Date(),
			user_id: userId,
			email,
			success: true,
			provider: 'local',
			event_type: eventType,
			session_id: sessionId,
			ip_address: ipAddress,
			user_agent: userAgent,
			country_code: 'UN',
			city: 'Unknown',
			device_info: {
				device_name: parsedUserAgent.deviceName,
				device_type: parsedUserAgent.deviceType,
				browser: parsedUserAgent.browser,
				os: parsedUserAgent.os
			}
		})
	}

	/**
	 * Logs an authentication event
	 * @param {AuthEventInput} entry - The authentication log entry
	 */
	async logEvent(entry: AuthEventInput): Promise<void> {
		// Create a new array instead of mutating the existing one
		this.queue = [...this.queue, entry]

		logger.debug(
			`Auth event queued: user_id=${entry.user_id}, email=${entry.email}, success=${entry.success}, provider=${entry.provider}`
		)

		this.processQueue()
	}

	/**
	 * Processes the queue of log entries
	 */
	private async processQueue(): Promise<void> {
		if (this.isProcessing || this.queue.length === 0) {
			return
		}

		this.isProcessing = true

		try {
			// Take items from the queue without mutation
			const batch = this.queue.slice(0, CONFIG.AUTH_LOG_BATCH_SIZE)
			this.queue = this.queue.slice(CONFIG.AUTH_LOG_BATCH_SIZE)

			logger.debug(`Processing ${batch.length} auth event entries`)
			await this.insertBatch(batch)
		} catch (error) {
			logger.error('Error processing auth event queue:', error)
		} finally {
			this.isProcessing = false
			if (this.queue.length > 0) {
				setTimeout(() => this.processQueue(), CONFIG.AUTH_LOG_PROCESS_INTERVAL)
			}
		}
	}

	/**
	 * Formats a date for ClickHouse
	 * @param {Date} date - The date to format
	 * @returns {string} Formatted date string
	 */
	private formatDate(date: Date): string {
		return date.toISOString().replace('T', ' ').replace('Z', '')
	}

	/**
	 * Inserts a batch of log entries into ClickHouse
	 * @param {readonly AuthEventInput[]} batch - The batch of log entries
	 */
	private async insertBatch(batch: readonly AuthEventInput[]): Promise<void> {
		const query = `
      INSERT INTO auth_logs 
      (timestamp, user_id, email, success, ip_address, user_agent, country_code, city, provider, error_message, session_id, event_type, device_name, device_type, browser, os)
      VALUES
    `

		// Map provider string to enum value
		const getProviderValue = (provider: string): number => {
			switch (provider) {
				case 'google':
					return 1
				case 'github':
					return 2
				case 'local':
					return 3
				default:
					return 3
			}
		}

		// Map event type to enum value
		const getEventTypeValue = (entry: AuthEventInput): number => {
			if (entry.event_type) {
				switch (entry.event_type) {
					case 'created':
						return 5 // SessionCreated
					case 'refreshed':
						return 6 // SessionRefreshed
					case 'expired':
						return 7 // SessionExpired
					case 'revoked':
						return 8 // SessionRevoked
					default:
						return 0
				}
			}

			// Default auth event types
			if (!entry.success) {
				return 4 // Failed
			}
			if (entry.provider === 'local' && !entry.session_id) {
				return 2 // Logout
			}
			return 1 // Login
		}

		// Map entries to values without mutation
		const values = batch
			.map(
				(entry) => `(
          '${this.formatDate(entry.timestamp)}',
          ${entry.user_id},
          '${entry.email}',
          ${entry.success ? 1 : 0},
          '${entry.ip_address}',
          '${entry.user_agent}',
          '${entry.country_code}',
          '${entry.city}',
          ${getProviderValue(entry.provider)},
          '${entry.error_message || ''}',
          '${entry.session_id || ''}',
          ${getEventTypeValue(entry)},
          '${entry.device_info?.device_name || ''}',
          '${entry.device_info?.device_type || ''}',
          '${entry.device_info?.browser || ''}',
          '${entry.device_info?.os || ''}'
        )`
			)
			.join(',')

		try {
			await clickhouseClient.exec({
				query: query + values,
				clickhouse_settings: {
					async_insert: 1
				}
			})
			logger.debug(`Successfully inserted ${batch.length} auth event entries into ClickHouse`)
		} catch (error) {
			logger.error('Failed to insert auth events into ClickHouse:', error)
			throw error
		}
	}

	/**
	 * Gets authentication statistics for a user
	 * @param {number} userId - The user ID to get statistics for
	 * @param {Date} startDate - The start date for the statistics
	 * @param {Date} endDate - The end date for the statistics
	 * @returns {Promise<AuthStatsResponse>} The authentication statistics
	 */
	async getStats(userId: number, startDate: Date, endDate: Date): Promise<AuthStatsResponse> {
		try {
			logger.debug(`Fetching auth stats for user: ${userId}`, {
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString()
			})

			const query = `
        SELECT 
          user_id,
          toDate(timestamp) as date,
          success,
          event_type,
          count() as attempts,
          arrayDistinct(groupArray(ip_address)) as unique_ips,
          arrayDistinct(groupArray(user_agent)) as unique_user_agents,
          arrayDistinct(groupArray(country_code)) as countries,
          arrayDistinct(groupArray(device_type)) as device_types,
          arrayDistinct(groupArray(browser)) as browsers,
          arrayDistinct(groupArray(os)) as operating_systems
        FROM auth_logs
        WHERE user_id = ${userId}
          AND timestamp >= toDateTime('${startDate.toISOString()}')
          AND timestamp <= toDateTime('${endDate.toISOString()}')
          AND event_type < 5 -- Only include auth events, not session events
        GROUP BY user_id, date, success, event_type
        ORDER BY date DESC
      `

			const result = await clickhouseClient.query({
				query,
				format: 'JSONEachRow'
			})

			// Parse the JSON result into our type
			const rawData = await result.json()

			// Ensure rawData is an array and cast it to our type
			const data: readonly AuthDailyStat[] = Array.isArray(rawData) ? (rawData as AuthDailyStat[]) : []

			// Calculate totals
			const totalSuccess = data.reduce((sum, stat) => sum + (stat.success ? stat.attempts : 0), 0)
			const totalFailure = data.reduce((sum, stat) => sum + (!stat.success ? stat.attempts : 0), 0)

			// Calculate unique IPs and countries across all records
			const allIPs = data.flatMap((stat) => stat.unique_ips)
			const allCountries = data.flatMap((stat) => stat.countries)
			const allDevices = data.flatMap((stat) => stat.device_types || [])
			const uniqueIPs = new Set(allIPs).size
			const uniqueCountries = new Set(allCountries).size
			const uniqueDevices = new Set(allDevices).size

			logger.info(`Auth stats retrieved successfully for user: ${userId}`, {
				recordCount: data.length,
				totalSuccess,
				totalFailure,
				uniqueIPs,
				uniqueCountries
			})

			return {
				success: true,
				data: {
					stats: data,
					totalSuccess,
					totalFailure,
					uniqueIPs,
					uniqueCountries,
					uniqueDevices
				}
			}
		} catch (error) {
			logger.error(`Failed to get auth stats for user ${userId}:`, error)
			return {
				success: false,
				error: `Failed to retrieve authentication statistics: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}

	/**
	 * Gets session statistics for a user
	 * @param {number} userId - The user ID to get statistics for
	 * @param {Date} startDate - The start date for the statistics
	 * @param {Date} endDate - The end date for the statistics
	 * @returns {Promise<AuthStatsResponse>} The session statistics
	 */
	async getSessionStats(userId: number, startDate: Date, endDate: Date): Promise<AuthStatsResponse> {
		try {
			logger.debug(`Fetching session stats for user: ${userId}`, {
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString()
			})

			const query = `
        SELECT 
          user_id,
          toDate(timestamp) as date,
          event_type,
          count() as attempts,
          arrayDistinct(groupArray(ip_address)) as unique_ips,
          arrayDistinct(groupArray(user_agent)) as unique_user_agents,
          arrayDistinct(groupArray(country_code)) as countries,
          arrayDistinct(groupArray(device_type)) as device_types,
          arrayDistinct(groupArray(browser)) as browsers,
          arrayDistinct(groupArray(os)) as operating_systems
        FROM auth_logs
        WHERE user_id = ${userId}
          AND timestamp >= toDateTime('${startDate.toISOString()}')
          AND timestamp <= toDateTime('${endDate.toISOString()}')
          AND event_type >= 5 -- Only include session events
        GROUP BY user_id, date, event_type
        ORDER BY date DESC
      `

			const result = await clickhouseClient.query({
				query,
				format: 'JSONEachRow'
			})

			// Parse the JSON result into our type
			const rawData = await result.json()

			// Ensure rawData is an array and cast it to our type
			const data: readonly (AuthDailyStat & { event_type: number })[] = Array.isArray(rawData)
				? (rawData as (AuthDailyStat & { event_type: number })[])
				: []

			// Calculate totals for session events
			const totalCreated = data.reduce((sum, stat) => sum + (stat.event_type === 5 ? stat.attempts : 0), 0)
			const totalRefreshed = data.reduce((sum, stat) => sum + (stat.event_type === 6 ? stat.attempts : 0), 0)
			const totalExpired = data.reduce((sum, stat) => sum + (stat.event_type === 7 ? stat.attempts : 0), 0)
			const totalRevoked = data.reduce((sum, stat) => sum + (stat.event_type === 8 ? stat.attempts : 0), 0)

			// Calculate unique devices across all records
			const allDevices = data.flatMap((stat) => stat.device_types || [])
			const uniqueDevices = new Set(allDevices).size

			logger.info(`Session stats retrieved successfully for user: ${userId}`, {
				recordCount: data.length,
				totalCreated,
				totalRefreshed,
				totalExpired,
				totalRevoked
			})

			return {
				success: true,
				data: {
					stats: data,
					totalSuccess: totalCreated + totalRefreshed,
					totalFailure: totalExpired + totalRevoked,
					uniqueIPs: new Set(data.flatMap((stat) => stat.unique_ips)).size,
					uniqueCountries: new Set(data.flatMap((stat) => stat.countries)).size,
					uniqueDevices
				}
			}
		} catch (error) {
			logger.error(`Failed to get session stats for user ${userId}:`, error)
			return {
				success: false,
				error: `Failed to retrieve session statistics: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}

	/**
	 * Gets the most recent authentication events for a user
	 * @param {number} userId - The user ID to get events for
	 * @param {number} limit - Maximum number of events to return
	 * @returns {Promise<AuthStatsResponse>} The recent authentication events
	 */
	async getRecentEvents(userId: number, limit = 10): Promise<AuthStatsResponse> {
		try {
			logger.debug(`Fetching recent auth events for user: ${userId}`, { limit })

			const query = `
        SELECT 
          user_id,
          toDate(timestamp) as date,
          success,
          event_type,
          1 as attempts,
          [ip_address] as unique_ips,
          [user_agent] as unique_user_agents,
          [country_code] as countries,
          [device_type] as device_types,
          [browser] as browsers,
          [os] as operating_systems
        FROM auth_logs
        WHERE user_id = ${userId}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `

			const result = await clickhouseClient.query({
				query,
				format: 'JSONEachRow'
			})

			// Parse the JSON result into our type
			const rawData = await result.json()

			// Ensure rawData is an array and cast it to our type
			const data: readonly (AuthDailyStat & { event_type: number })[] = Array.isArray(rawData)
				? (rawData as (AuthDailyStat & { event_type: number })[])
				: []

			// Count events by success/failure
			const successCount = data.filter((event) => event.success).length
			const failureCount = data.filter((event) => !event.success).length

			// Calculate unique IPs and countries
			const allIPs = data.flatMap((stat) => stat.unique_ips)
			const allCountries = data.flatMap((stat) => stat.countries)
			const allDevices = data.flatMap((stat) => stat.device_types || [])
			const uniqueIPs = new Set(allIPs).size
			const uniqueCountries = new Set(allCountries).size
			const uniqueDevices = new Set(allDevices).size

			logger.info(`Recent auth events retrieved successfully for user: ${userId}`, {
				recordCount: data.length,
				successCount,
				failureCount
			})

			return {
				success: true,
				data: {
					stats: data,
					totalSuccess: successCount,
					totalFailure: failureCount,
					uniqueIPs,
					uniqueCountries,
					uniqueDevices
				}
			}
		} catch (error) {
			logger.error(`Failed to get recent auth events for user ${userId}:`, error)
			return {
				success: false,
				error: `Failed to retrieve recent authentication events: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}
}

export const authEventService = new AuthEventService()
